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
 * Strict JSON line parser for ESP32 JSON protocol
 */
export function parseSerialJsonLine(line: string): ESP32Message | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) {
    return null;
  }
  try {
    const parsed = JSON.parse(trimmed) as ESP32Message;
    if (typeof parsed === 'object' && parsed !== null) {
      if (parsed.pin !== undefined) {
        parsed.pin = formatSixDigitPin(parsed.pin);
      }
      return parsed;
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Safely parse any serial line into an ESP32Message.
 * Supports:
 * 1. Pure JSON format: {"type":"STATUS","pin":"084291",...}
 * 2. Embedded JSON inside serial logs: [ESP32] {"pin":"084291"}
 * 3. Plain text outputs from Arduino Serial.println:
 *    - "PIN: 084291" or "PIN AKTIF: 084291"
 *    - "Tanggal: 2026-11-09, Waktu: 19:30:00, Periode: 43821, PIN: 084291"
 *    - "STEP: 43821, PIN: 084291, DOOR: CLOSED"
 *    - "DOOR_OPEN" / "DOOR_CLOSED"
 *    - "RTC_OK" / "RTC_ERROR"
 *    - Raw 6-digit line: "084291"
 */
export function parseAnySerialLine(line: string): ESP32Message | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  // 1. Check for pure or embedded JSON {...}
  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    const jsonCandidate = trimmed.slice(firstBrace, lastBrace + 1);
    try {
      const parsed = JSON.parse(jsonCandidate) as ESP32Message;
      if (typeof parsed === 'object' && parsed !== null) {
        if (parsed.pin !== undefined) {
          parsed.pin = formatSixDigitPin(parsed.pin);
        }
        return parsed;
      }
    } catch {
      // continue to regex extraction
    }
  }

  // 2. Extract fields from plain text / Serial.print output
  const msg: ESP32Message = { type: 'RAW' };
  let hasData = false;

  // Extract PIN (e.g. "PIN: 084291", "PIN=084291", "PIN AKTIF: 084291", "PIN SAAT INI: 084291", "084291", "KODE: 084291")
  const pinMatch = trimmed.match(/(?:PIN|PIN\s*AKTIF|PIN\s*SAAT\s*INI|PIN\s*DINAMIS|PASSCODE|CODE|KODE|KEY)\s*[:=]?\s*([0-9]{4,8})/i)
    || trimmed.match(/\bPIN\b.*?([0-9]{6})/i)
    || trimmed.match(/^([0-9]{6})$/);
  if (pinMatch && pinMatch[1]) {
    msg.pin = formatSixDigitPin(pinMatch[1]);
    hasData = true;
  }

  // Extract Period (e.g. "PERIODE: 43821", "PERIOD: 43821", "STEP: 43821", "SIKLUS: 43821")
  const periodMatch = trimmed.match(/(?:PERIOD|PERIODE|STEP|SIKLUS)\s*[:=]?\s*([0-9]+)/i);
  if (periodMatch && periodMatch[1]) {
    msg.period = Number(periodMatch[1]);
    hasData = true;
  }

  // Extract Date (YYYY-MM-DD)
  const dateMatch = trimmed.match(/\b([0-9]{4}-[0-9]{2}-[0-9]{2})\b/);
  if (dateMatch && dateMatch[1]) {
    msg.date = dateMatch[1];
    hasData = true;
  }

  // Extract Time (HH:mm:ss)
  const timeMatch = trimmed.match(/\b([0-9]{2}:[0-9]{2}:[0-9]{2})\b/);
  if (timeMatch && timeMatch[1]) {
    msg.time = timeMatch[1];
    hasData = true;
  }

  // Extract Door status
  if (/\b(?:DOOR_OPEN|PINTU_TERBUKA)\b/i.test(trimmed) || /(?:DOOR|PINTU)\s*[:=]?\s*(?:OPEN|BUKA|TERBUKA)/i.test(trimmed)) {
    msg.door = 'OPEN';
    hasData = true;
  } else if (/\b(?:DOOR_CLOSED|PINTU_TERTUTUP)\b/i.test(trimmed) || /(?:DOOR|PINTU)\s*[:=]?\s*(?:CLOSED|CLOSE|TERTUTUP|KUNCI|TERKUNCI)/i.test(trimmed)) {
    msg.door = 'CLOSED';
    hasData = true;
  }

  // Extract RTC status
  if (/\b(?:RTC_ERROR|RTC_NOT_READY)\b/i.test(trimmed) || /RTC\s*[:=]?\s*ERROR/i.test(trimmed)) {
    msg.rtc = 'ERROR';
    msg.message = 'RTC NOT READY';
    hasData = true;
  } else if (/\b(?:RTC_OK|RTC_READY)\b/i.test(trimmed) || /RTC\s*[:=]?\s*OK/i.test(trimmed) || (msg.date && msg.time)) {
    msg.rtc = 'OK';
    hasData = true;
  }

  return hasData ? msg : { type: 'RAW', message: trimmed };
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

  // Requirement: Once serial communication is received, set device status as CONNECTED
  if (nextState.connectionStatus !== 'CONNECTED') {
    nextState.connectionStatus = 'CONNECTED';
    pushLog('CONNECT', 'ESP32 berhasil terhubung dan stream data aktif');
  }

  // 1. Process RTC status and time
  if (message.rtc) {
    const isRtcOk = String(message.rtc).toUpperCase() === 'OK';
    const newRtcStatus = isRtcOk ? 'OK' : 'ERROR';
    
    if (currentState.rtcStatus !== newRtcStatus) {
      if (isRtcOk) {
        pushLog('RTC_OK', 'RTC DS1302 berhasil dibaca (Normal)');
      } else {
        pushLog('RTC_ERROR', 'RTC DS1302 mengalami error!', message.message || 'RTC NOT READY');
      }
    }
    nextState.rtcStatus = newRtcStatus;
  } else if (currentState.rtcStatus === 'UNKNOWN' && (message.date || message.time || message.pin)) {
    // If not specified as error, default to OK when valid telemetry or PIN is received
    nextState.rtcStatus = 'OK';
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

  // Process PIN - directly updates PIN and marks status as ACTIVE
  if (message.pin !== undefined && message.pin !== null) {
    const formattedPin = formatSixDigitPin(message.pin);
    if (formattedPin && formattedPin.length === 6) {
      const isNewPin = currentState.pin !== formattedPin;
      nextState.pin = formattedPin;
      nextState.pinStatus = nextState.rtcStatus === 'ERROR' ? 'INVALID' : 'ACTIVE';
      
      if (isNewPin) {
        pushLog('INFO', `PIN Akses ESP32 sinkron dari Serial Monitor: ${formattedPin}`);
      }
    }
  }

  // If RTC is explicitly error, invalidate PIN
  if (nextState.rtcStatus === 'ERROR') {
    nextState.pinStatus = 'INVALID';
  } else if (nextState.pin && nextState.pin.length === 6) {
    nextState.pinStatus = 'ACTIVE';
  }

  // 4. Process Error message type
  if (message.type === 'ERROR' || (message.message && message.rtc === 'ERROR')) {
    nextState.errorMessage = message.message || 'Perangkat melaporkan kesalahan.';
    pushLog('ERROR', `Error dari ESP32: ${nextState.errorMessage}`);
  }

  return { nextState, newLogs };
}
