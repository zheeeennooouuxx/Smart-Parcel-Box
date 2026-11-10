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

  // Extract PIN (e.g. "PIN: 084291", "PIN saat ini  : 084291", "PIN AKTIF: 084291", "084291", "KODE: 084291")
  const pinMatch = trimmed.match(/(?:PIN|PIN\s*AKTIF|PIN\s*SAAT\s*INI|PIN\s*DINAMIS|PASSCODE|CODE|KODE|KEY)\s*[:=]?\s*([0-9]{4,8})/i)
    || trimmed.match(/\bPIN\b.*?([0-9]{6})/i)
    || trimmed.match(/^([0-9]{6})$/);
  if (pinMatch && pinMatch[1]) {
    msg.pin = formatSixDigitPin(pinMatch[1]);
    hasData = true;
  }

  // Extract Period (e.g. "Periode PIN   : 43821", "PERIODE: 43821", "PERIOD: 43821", "STEP: 43821", "SIKLUS: 43821")
  const periodMatch = trimmed.match(/(?:PERIOD|PERIODE|STEP|SIKLUS)\s*(?:PIN)?\s*[:=]?\s*([0-9]+)/i);
  if (periodMatch && periodMatch[1]) {
    msg.period = Number(periodMatch[1]);
    hasData = true;
  }

  // Extract Date (DD/MM/YYYY or YYYY-MM-DD, e.g. "Tanggal WITA : 11/11/2026", "Tanggal : 11/11/2026")
  const dateMatch = trimmed.match(/(?:Tanggal(?:\s*WITA)?\s*[:=]?\s*)([0-9]{2}[\/-][0-9]{2}[\/-][0-9]{4})\b/i)
    || trimmed.match(/\b([0-9]{2}[\/-][0-9]{2}[\/-][0-9]{4})\b/)
    || trimmed.match(/\b([0-9]{4}-[0-9]{2}-[0-9]{2})\b/);
  if (dateMatch && dateMatch[1]) {
    msg.date = dateMatch[1];
    hasData = true;
  }

  // Extract Time (HH:mm:ss, e.g. "Jam WITA : 01:04:50", "Waktu : 01:04:50")
  const timeMatch = trimmed.match(/(?:(?:Jam|Waktu)(?:\s*WITA)?\s*[:=]?\s*)([0-9]{2}:[0-9]{2}:[0-9]{2})\b/i)
    || trimmed.match(/\b([0-9]{2}:[0-9]{2}:[0-9]{2})\b/);
  if (timeMatch && timeMatch[1]) {
    msg.time = timeMatch[1];
    hasData = true;
  }

  // Extract Time Zone (e.g. "Zona waktu: WITA (UTC+8)", "Zona Waktu    : WITA (Makassar)")
  const tzMatch = trimmed.match(/(?:Zona\s*Waktu)\s*[:=]?\s*(.+)$/i);
  if (tzMatch && tzMatch[1]) {
    msg.timeZone = tzMatch[1].trim();
    hasData = true;
  }

  // Extract WiFi SSID (e.g. "Nama Wi-Fi : AAA")
  const ssidMatch = trimmed.match(/(?:Nama\s*Wi-?Fi|SSID)\s*[:=]?\s*(.+)$/i);
  if (ssidMatch && ssidMatch[1]) {
    msg.wifiSsid = ssidMatch[1].trim();
    hasData = true;
  }

  // Extract WiFi IP Address (e.g. "Alamat IP  : 10.86.29.138")
  const ipMatch = trimmed.match(/(?:Alamat\s*IP|IP\s*Address|Local\s*IP|IP)\s*[:=]?\s*([0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3})/i);
  if (ipMatch && ipMatch[1]) {
    msg.wifiIp = ipMatch[1].trim();
    hasData = true;
  }

  // Extract Gateway (e.g. "Gateway     : 10.86.29.155")
  const gatewayMatch = trimmed.match(/(?:Gateway|Default\s*Gateway)\s*[:=]?\s*([0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3})/i);
  if (gatewayMatch && gatewayMatch[1]) {
    msg.wifiGateway = gatewayMatch[1].trim();
    hasData = true;
  }

  // Extract Subnet Mask (e.g. "Subnet Mask : 255.255.255.0")
  const subnetMatch = trimmed.match(/(?:Subnet\s*Mask|Subnet|Netmask)\s*[:=]?\s*([0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3})/i);
  if (subnetMatch && subnetMatch[1]) {
    msg.wifiSubnet = subnetMatch[1].trim();
    hasData = true;
  }

  // Extract WiFi Signal RSSI (e.g. "Kekuatan   : -16 dBm")
  const rssiMatch = trimmed.match(/(?:Kekuatan|Signal|RSSI)\s*[:=]?\s*(-?[0-9]+)\s*(?:dBm)?/i);
  if (rssiMatch && rssiMatch[1]) {
    msg.wifiRssi = Number(rssiMatch[1]);
    hasData = true;
  }

  // Extract WiFi connection events
  if (/WIFI\s*BERHASIL\s*TERHUBUNG/i.test(trimmed)) {
    msg.type = 'WIFI';
    msg.message = 'WiFi berhasil terhubung ke Hotspot';
    hasData = true;
  } else if (/Wi-?Fi\s*terputus!/i.test(trimmed)) {
    msg.type = 'WIFI';
    msg.message = 'WiFi terputus dari Hotspot';
    hasData = true;
  }

  // Extract RTC sync events
  if (/WAKTU\s*RTC\s*BERHASIL\s*DISINKRONKAN/i.test(trimmed)) {
    msg.rtc = 'OK';
    msg.message = 'Waktu RTC berhasil disinkronkan dari server NTP';
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
  if (/\b(?:RTC_ERROR|RTC_NOT_READY)\b/i.test(trimmed) || /RTC\s*(?:DS1302)?\s*ERROR/i.test(trimmed)) {
    msg.rtc = 'ERROR';
    msg.message = 'RTC NOT READY';
    hasData = true;
  } else if (/RTC\s*(?:DS1302)?\s*SIAP!/i.test(trimmed) || /\b(?:RTC_OK|RTC_READY)\b/i.test(trimmed) || /RTC\s*[:=]?\s*OK/i.test(trimmed) || (msg.date && msg.time)) {
    msg.rtc = 'OK';
    hasData = true;
  }

  // Extract MAC Address (e.g. "MAC: f4:65:0b:57:13:bc")
  const macMatch = trimmed.match(/(?:MAC|STA_MAC|AP_MAC)\s*[:=]?\s*([0-9a-fA-F]{2}(?::[0-9a-fA-F]{2}){5})/i);
  if (macMatch && macMatch[1]) {
    msg.macAddress = macMatch[1].toLowerCase();
    hasData = true;
  }

  // Extract Chip model (e.g. "Chip type: ESP32-D0WD-V3" or "Connected to ESP32 on COM4")
  const chipMatch = trimmed.match(/(?:Chip\s*(?:type)?|Model)\s*[:=]?\s*([A-Za-z0-9\-_]+(?:\s*\(.*?\))?)/i);
  if (chipMatch && chipMatch[1]) {
    msg.chipInfo = chipMatch[1].trim();
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
    wifiConfig: { ...currentState.wifiConfig },
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

  // Process Hardware chip & MAC address
  if (message.chipInfo) {
    nextState.chipInfo = message.chipInfo;
  }
  if (message.macAddress) {
    nextState.macAddress = message.macAddress;
    pushLog('INFO', `Perangkat ESP32 Terdeteksi: MAC ${message.macAddress}`);
  }

  // Process WiFi Hotspot / Station info from ESP32
  if (message.wifiSsid) {
    nextState.wifiConfig.ssid = message.wifiSsid;
    pushLog('INFO', `ESP32 terhubung ke Wi-Fi Hotspot: ${message.wifiSsid}`);
  }

  if (message.wifiIp) {
    const isNewIp = nextState.wifiConfig.ip !== message.wifiIp;
    nextState.wifiConfig.ip = message.wifiIp;
    nextState.wifiConfig.autoDetectedFromSerial = true;
    if (isNewIp) {
      pushLog('WIFI_CONNECT', `Alamat IP ESP32 Tercatat Otomatis: ${message.wifiIp}`, `SSID: ${nextState.wifiConfig.ssid || 'AAA'}`);
    }
  }

  if (message.wifiGateway) {
    nextState.wifiGateway = message.wifiGateway;
    nextState.wifiConfig.gateway = message.wifiGateway;
    pushLog('INFO', `Gateway Wi-Fi: ${message.wifiGateway}`);
  }

  if (message.wifiSubnet) {
    nextState.wifiSubnet = message.wifiSubnet;
    nextState.wifiConfig.subnet = message.wifiSubnet;
  }

  if (message.wifiRssi !== undefined) {
    nextState.wifiRssi = message.wifiRssi;
  }

  if (message.timeZone) {
    nextState.timeZone = message.timeZone;
  }

  if (message.type === 'WIFI') {
    if (message.message?.includes('terputus')) {
      pushLog('WIFI_DISCONNECT', 'Koneksi Wi-Fi ESP32 terputus dari Hotspot');
    } else if (message.message?.includes('berhasil')) {
      pushLog('WIFI_CONNECT', 'Wi-Fi ESP32 berhasil terhubung ke Hotspot', nextState.wifiConfig.ssid || 'AAA');
    }
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
