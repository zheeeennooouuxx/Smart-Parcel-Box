/**
 * Serial Stream Buffer and JSON Message Parser for ESP32
 * Handles fragmented chunks, newline separation, JSON parsing, and state updates.
 */

import { ESP32Message, ParcelBoxState, ActivityLog, LogEventType } from '../types/serial';

/**
 * Format any PIN input to guaranteed 6 digits with leading zeros.
 * Returns empty string if invalid or null/undefined.
 */
export function formatSixDigitPin(pinVal: unknown): string {
  if (pinVal === null || pinVal === undefined) return '';
  const str = String(pinVal).trim();
  if (!str) return '';
  // Check if string contains only digits
  if (/^\d+$/.test(str)) {
    return str.padStart(6, '0').slice(-6);
  }
  return str;
}

/**
 * Stream buffer accumulator that collects chunks of text and emits complete lines.
 */
export class LineBufferAccumulator {
  private buffer: string = '';

  /**
   * Push an incoming string chunk into the buffer.
   * Returns an array of complete lines split by \r\n or \n.
   */
  public push(chunk: string): string[] {
    this.buffer += chunk;
    const lines: string[] = [];
    
    let newlineIndex: number;
    while ((newlineIndex = this.buffer.indexOf('\n')) !== -1) {
      let line = this.buffer.slice(0, newlineIndex);
      this.buffer = this.buffer.slice(newlineIndex + 1);
      
      // Remove trailing \r if present
      if (line.endsWith('\r')) {
        line = line.slice(0, -1);
      }
      
      line = line.trim();
      if (line.length > 0) {
        lines.push(line);
      }
    }

    // Safety: prevent unbounded memory leak if no newlines received for long time
    if (this.buffer.length > 8192) {
      this.buffer = this.buffer.slice(-1024);
    }

    return lines;
  }

  /**
   * Clear the internal buffer (e.g. on disconnect)
   */
  public reset(): void {
    this.buffer = '';
  }

  public getRemaining(): string {
    return this.buffer;
  }
}

/**
 * Safely parse a serial line into an ESP32Message.
 * Returns null if the line is not valid JSON.
 */
export function parseSerialJsonLine(line: string): ESP32Message | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) {
    return null;
  }

  try {
    const parsed = JSON.parse(trimmed) as ESP32Message;
    if (typeof parsed !== 'object' || parsed === null) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Apply parsed ESP32Message to the current ParcelBoxState.
 * Returns the updated state along with any new activity logs generated.
 */
export function processESP32Message(
  currentState: ParcelBoxState,
  message: ESP32Message,
  nowIsoString: string = new Date().toISOString()
): {
  nextState: ParcelBoxState;
  newLogs: ActivityLog[];
} {
  const newLogs: ActivityLog[] = [];
  const nextState: ParcelBoxState = {
    ...currentState,
    lastUpdated: Date.now(),
    rxPacketCount: currentState.rxPacketCount + 1,
  };

  // Helper to push a log
  const pushLog = (type: LogEventType, msg: string, details?: string) => {
    newLogs.push({
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: nowIsoString,
      type,
      message: msg,
      details,
    });
  };

  // 1. Process RTC status and time
  if (message.rtc) {
    const isRtcOk = message.rtc.toUpperCase() === 'OK';
    const newRtcStatus = isRtcOk ? 'OK' : 'ERROR';
    
    if (currentState.rtcStatus !== newRtcStatus) {
      if (isRtcOk) {
        pushLog('RTC_OK', 'RTC DS1302 berhasil dibaca (Normal)');
      } else {
        pushLog('RTC_ERROR', 'RTC DS1302 mengalami error!', message.message || 'RTC NOT READY');
      }
    }
    nextState.rtcStatus = newRtcStatus;
  }

  if (message.date) {
    nextState.date = String(message.date);
  }
  if (message.time) {
    nextState.time = String(message.time);
  }

  // 2. Process Door status
  if (message.door) {
    const upperDoor = String(message.door).toUpperCase();
    const isDoorOpen = upperDoor === 'OPEN';
    const newDoorStatus = isDoorOpen ? 'OPEN' : 'CLOSED';

    if (currentState.doorStatus !== newDoorStatus && currentState.doorStatus !== 'UNKNOWN') {
      if (isDoorOpen) {
        pushLog('DOOR_OPEN', 'Pintu Smart Parcel Box dibuka (Reed Switch OPEN)');
      } else {
        pushLog('DOOR_CLOSED', 'Pintu Smart Parcel Box ditutup (Reed Switch CLOSED)');
      }
    } else if (currentState.doorStatus === 'UNKNOWN') {
      pushLog(
        isDoorOpen ? 'DOOR_OPEN' : 'DOOR_CLOSED',
        `Status pintu terdeteksi: ${isDoorOpen ? 'TERBUKA' : 'TERTUTUP'}`
      );
    }
    nextState.doorStatus = newDoorStatus;
  }

  // 3. Process Period & PIN
  if (message.period !== undefined && message.period !== null) {
    const newPeriod = Number(message.period);
    if (!isNaN(newPeriod)) {
      if (currentState.period !== undefined && currentState.period !== newPeriod) {
        pushLog('PIN_CHANGE', `PIN beralih ke periode baru: #${newPeriod}`);
      }
      nextState.period = newPeriod;
    }
  }

  if (message.pin !== undefined && message.pin !== null) {
    const formattedPin = formatSixDigitPin(message.pin);
    if (formattedPin && formattedPin.length === 6) {
      nextState.pin = formattedPin;
      nextState.pinStatus = nextState.rtcStatus === 'ERROR' ? 'INVALID' : 'ACTIVE';
    }
  }

  // If RTC is error, ensure PIN status is marked as invalid or error
  if (nextState.rtcStatus === 'ERROR') {
    nextState.pinStatus = 'INVALID';
  }

  // 4. Process Error message type
  if (message.type === 'ERROR' || message.message) {
    if (message.type === 'ERROR') {
      nextState.errorMessage = message.message || 'Perangkat melaporkan kesalahan.';
      pushLog('ERROR', `Error dari ESP32: ${nextState.errorMessage}`);
    }
  }

  // If we were waiting for device and received a valid message, mark as CONNECTED
  if (nextState.connectionStatus === 'CONNECTING') {
    nextState.connectionStatus = 'CONNECTED';
    pushLog('CONNECT', 'ESP32 berhasil terhubung dan stream data aktif');
  }

  return { nextState, newLogs };
}
