import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatSixDigitPin,
  LineBufferAccumulator,
  parseSerialJsonLine,
  parseAnySerialLine,
  processESP32Message,
} from './serialParser';
import { ParcelBoxState } from '../types/serial';

test('formatSixDigitPin pads numbers and strings with leading zeros up to 6 digits', () => {
  assert.equal(formatSixDigitPin('84291'), '084291');
  assert.equal(formatSixDigitPin(84291), '084291');
  assert.equal(formatSixDigitPin('084291'), '084291');
  assert.equal(formatSixDigitPin('7'), '000007');
  assert.equal(formatSixDigitPin(0), '000000');
  assert.equal(formatSixDigitPin(null), '');
  assert.equal(formatSixDigitPin(undefined), '');
});

test('LineBufferAccumulator handles chunked streaming input with split newlines', () => {
  const accumulator = new LineBufferAccumulator();
  
  // Chunk 1: incomplete line
  const lines1 = accumulator.push('{"type":"STATUS","rtc":');
  assert.deepEqual(lines1, []);

  // Chunk 2: completes first line and starts second line
  const lines2 = accumulator.push('"OK"}\r\n{"type":"DOOR"');
  assert.deepEqual(lines2, ['{"type":"STATUS","rtc":"OK"}']);

  // Chunk 3: finishes second line
  const lines3 = accumulator.push(',"door":"OPEN"}\n');
  assert.deepEqual(lines3, ['{"type":"DOOR","door":"OPEN"}']);
});

test('LineBufferAccumulator handles multiple complete lines in single packet', () => {
  const accumulator = new LineBufferAccumulator();
  const chunk = 'LINE1\nLINE2\r\nLINE3\n';
  const lines = accumulator.push(chunk);
  assert.deepEqual(lines, ['LINE1', 'LINE2', 'LINE3']);
  assert.equal(accumulator.getRemaining(), '');
});

test('parseSerialJsonLine successfully parses valid JSON object lines and rejects invalid strings', () => {
  const validLine = '{"type":"STATUS","rtc":"OK","date":"2026-11-09","time":"19:30:00","period":43821,"pin":"084291","door":"CLOSED"}';
  const parsed = parseSerialJsonLine(validLine);
  assert.ok(parsed);
  assert.equal(parsed?.type, 'STATUS');
  assert.equal(parsed?.rtc, 'OK');
  assert.equal(parsed?.period, 43821);
  assert.equal(parsed?.pin, '084291');
  assert.equal(parsed?.door, 'CLOSED');

  assert.equal(parseSerialJsonLine('Just a regular serial text without json'), null);
  assert.equal(parseSerialJsonLine('{not valid json}'), null);
  assert.equal(parseSerialJsonLine(''), null);
});

const mockBaseState: ParcelBoxState = {
  connectionStatus: 'DISCONNECTED',
  connectionType: 'SERIAL',
  baudRate: 9600,
  wifiConfig: {
    ip: '192.168.4.1',
    port: 80,
    ssid: 'SMART-PARCEL-BOX-AP',
    intervalMs: 2000,
    protocol: 'HTTP_POLL',
  },
  rtcStatus: 'UNKNOWN',
  pinStatus: 'WAITING_DEVICE',
  doorStatus: 'UNKNOWN',
  rxPacketCount: 0,
  rxBytesCount: 0,
};

test('processESP32Message updates state and logs for normal status and transitions to CONNECTED', () => {
  const initialState: ParcelBoxState = {
    ...mockBaseState,
    connectionStatus: 'CONNECTING',
  };

  const msg = {
    type: 'STATUS',
    rtc: 'OK',
    date: '2026-11-09',
    time: '19:30:00',
    period: 43821,
    pin: '084291',
    door: 'CLOSED'
  };

  const { nextState, newLogs } = processESP32Message(initialState, msg, '2026-11-09T19:30:00Z');

  assert.equal(nextState.connectionStatus, 'CONNECTED');
  assert.equal(nextState.rtcStatus, 'OK');
  assert.equal(nextState.date, '2026-11-09');
  assert.equal(nextState.time, '19:30:00');
  assert.equal(nextState.period, 43821);
  assert.equal(nextState.pin, '084291');
  assert.equal(nextState.pinStatus, 'ACTIVE');
  assert.equal(nextState.doorStatus, 'CLOSED');
  assert.equal(nextState.rxPacketCount, 1);

  // Check generated logs
  const logTypes = newLogs.map(l => l.type);
  assert.ok(logTypes.includes('RTC_OK'));
  assert.ok(logTypes.includes('CONNECT'));
  assert.ok(logTypes.includes('DOOR_CLOSED'));
});

test('processESP32Message handles RTC error correctly and invalidates PIN', () => {
  const initialState: ParcelBoxState = {
    ...mockBaseState,
    connectionStatus: 'CONNECTED',
    rtcStatus: 'OK',
    pin: '084291',
    pinStatus: 'ACTIVE',
    doorStatus: 'CLOSED',
    rxPacketCount: 5,
    rxBytesCount: 100,
  };

  const errorMsg = {
    type: 'ERROR',
    rtc: 'ERROR',
    message: 'RTC NOT READY'
  };

  const { nextState, newLogs } = processESP32Message(initialState, errorMsg, '2026-11-09T19:35:00Z');

  assert.equal(nextState.rtcStatus, 'ERROR');
  assert.equal(nextState.pinStatus, 'INVALID');
  assert.equal(nextState.errorMessage, 'RTC NOT READY');
  
  const rtcErrorLog = newLogs.find(l => l.type === 'RTC_ERROR');
  assert.ok(rtcErrorLog);
  assert.match(rtcErrorLog?.details || '', /RTC NOT READY/);
});

test('processESP32Message handles door state transition from CLOSED to OPEN', () => {
  const initialState: ParcelBoxState = {
    ...mockBaseState,
    connectionStatus: 'CONNECTED',
    rtcStatus: 'OK',
    pin: '084291',
    pinStatus: 'ACTIVE',
    doorStatus: 'CLOSED',
    rxPacketCount: 1,
    rxBytesCount: 10,
  };

  const doorMsg = {
    type: 'DOOR',
    door: 'OPEN'
  };

  const { nextState, newLogs } = processESP32Message(initialState, doorMsg);
  assert.equal(nextState.doorStatus, 'OPEN');
  assert.ok(newLogs.some(l => l.type === 'DOOR_OPEN'));
});

test('parseAnySerialLine extracts PIN and metadata from plain-text serial outputs', () => {
  // Plain text PIN formats
  const parsed1 = parseAnySerialLine('PIN: 084291');
  assert.equal(parsed1?.pin, '084291');

  const parsed2 = parseAnySerialLine('PIN AKTIF: 84291');
  assert.equal(parsed2?.pin, '084291');

  const parsed3 = parseAnySerialLine('[ESP32] SIKLUS: 43821, PIN: 084291, DOOR: CLOSED, RTC: OK');
  assert.equal(parsed3?.pin, '084291');
  assert.equal(parsed3?.period, 43821);
  assert.equal(parsed3?.door, 'CLOSED');
  assert.equal(parsed3?.rtc, 'OK');

  const parsed4 = parseAnySerialLine('084291');
  assert.equal(parsed4?.pin, '084291');

  const parsed5 = parseAnySerialLine('DOOR_OPEN');
  assert.equal(parsed5?.door, 'OPEN');
});

test('processESP32Message transitions DISCONNECTED state to CONNECTED upon receiving serial communication', () => {
  const disconnectedState: ParcelBoxState = {
    ...mockBaseState,
  };

  const incomingPinMsg = parseAnySerialLine('PIN: 084291')!;
  assert.ok(incomingPinMsg);

  const { nextState, newLogs } = processESP32Message(disconnectedState, incomingPinMsg);

  // Status must be CONNECTED
  assert.equal(nextState.connectionStatus, 'CONNECTED');
  // PIN must be active with leading zero
  assert.equal(nextState.pin, '084291');
  assert.equal(nextState.pinStatus, 'ACTIVE');
  // Logs must record connection and pin sync
  assert.ok(newLogs.some(l => l.type === 'CONNECT'));
  assert.ok(newLogs.some(l => l.type === 'INFO' && l.message.includes('084291')));
});

test('parseAnySerialLine extracts data from WiFi Hotspot HTTP and WebSocket telemetry lines', () => {
  // HTTP REST response format
  const httpLine = '[HTTP GET 200] {"type":"STATUS","rtc":"OK","date":"2026-11-09","time":"12:30:00","period":43821,"pin":"084291","door":"CLOSED"}';
  const parsedHttp = parseAnySerialLine(httpLine);
  assert.ok(parsedHttp);
  assert.equal(parsedHttp?.pin, '084291');
  assert.equal(parsedHttp?.period, 43821);
  assert.equal(parsedHttp?.door, 'CLOSED');
  assert.equal(parsedHttp?.rtc, 'OK');

  // WebSocket message format
  const wsLine = '[WS RX] {"type":"DOOR","door":"OPEN"}';
  const parsedWs = parseAnySerialLine(wsLine);
  assert.ok(parsedWs);
  assert.equal(parsedWs?.door, 'OPEN');

  // Hotspot reply format
  const replyLine = '[HOTSPOT HTTP 200] {"pin":"084291","period":43821,"status":"ACTIVE"}';
  const parsedReply = parseAnySerialLine(replyLine);
  assert.ok(parsedReply);
  assert.equal(parsedReply?.pin, '084291');
  assert.equal(parsedReply?.period, 43821);
});

test('parseAnySerialLine and processESP32Message support user exact ESP32 sketch lines and Hotspot AAA', () => {
  // Test WiFi credentials and IP parsing
  const wifiSsidLine = parseAnySerialLine('Nama Wi-Fi : AAA');
  assert.equal(wifiSsidLine?.wifiSsid, 'AAA');

  const wifiIpLine = parseAnySerialLine('Alamat IP  : 192.168.43.120');
  assert.equal(wifiIpLine?.wifiIp, '192.168.43.120');

  const wifiRssiLine = parseAnySerialLine('Kekuatan   : -58 dBm');
  assert.equal(wifiRssiLine?.wifiRssi, -58);

  // Test Time and PIN lines from user's sketch
  const tglLine = parseAnySerialLine('Tanggal       : 09/11/2026');
  assert.equal(tglLine?.date, '09/11/2026');

  const timeLine = parseAnySerialLine('Waktu         : 20:30:15');
  assert.equal(timeLine?.time, '20:30:15');

  const periodLine = parseAnySerialLine('Periode PIN   : 43821');
  assert.equal(periodLine?.period, 43821);

  const pinLine = parseAnySerialLine('PIN saat ini  : 084291');
  assert.equal(pinLine?.pin, '084291');

  const rtcLine = parseAnySerialLine('RTC DS1302 SIAP!');
  assert.equal(rtcLine?.rtc, 'OK');

  const doorOpenLine = parseAnySerialLine('PINTU TERBUKA');
  assert.equal(doorOpenLine?.door, 'OPEN');

  const doorClosedLine = parseAnySerialLine('PINTU TERTUTUP');
  assert.equal(doorClosedLine?.door, 'CLOSED');

  // Verify processESP32Message automatically sets IP and SSID in state
  let testState: ParcelBoxState = {
    ...mockBaseState,
  };

  const { nextState: stateWithWifi } = processESP32Message(testState, wifiIpLine!);
  assert.equal(stateWithWifi.wifiConfig.ip, '192.168.43.120');
  assert.equal(stateWithWifi.connectionStatus, 'CONNECTED');

  const { nextState: stateWithPin } = processESP32Message(stateWithWifi, pinLine!);
  assert.equal(stateWithPin.pin, '084291');
  assert.equal(stateWithPin.pinStatus, 'ACTIVE');

  // Test MAC address and Chip model parsing
  const macLine = parseAnySerialLine('MAC: f4:65:0b:57:13:bc');
  assert.equal(macLine?.macAddress, 'f4:65:0b:57:13:bc');

  const chipLine = parseAnySerialLine('Chip type: ESP32-D0WD-V3');
  assert.equal(chipLine?.chipInfo, 'ESP32-D0WD-V3');

  const { nextState: stateWithChip } = processESP32Message(stateWithPin, chipLine!);
  assert.equal(stateWithChip.chipInfo, 'ESP32-D0WD-V3');

  const { nextState: stateWithMac } = processESP32Message(stateWithChip, macLine!);
  assert.equal(stateWithMac.macAddress, 'f4:65:0b:57:13:bc');
});

test('parseAnySerialLine and processESP32Message automatically record 10.86.29.138 IP, Gateway, WITA time, and PIN 714502', () => {
  const serialDump = [
    '================================',
    '     WIFI BERHASIL TERHUBUNG',
    '================================',
    'Nama Wi-Fi  : AAA',
    'Alamat IP   : 10.86.29.138',
    'Gateway     : 10.86.29.155',
    'Subnet Mask : 255.255.255.0',
    'Kekuatan    : -16 dBm',
    '================================',
    'SINKRONISASI WAKTU WITA',
    '================================',
    'Mengambil waktu dari server NTP...',
    'Zona waktu: WITA (UTC+8)',
    '..',
    'WAKTU RTC BERHASIL DISINKRONKAN!',
    'Tanggal WITA : 11/11/2026',
    'Jam WITA     : 01:04:50',
    '================================',
    'Zona Waktu    : WITA (Makassar)',
    'Tanggal       : 11/11/2026',
    'Waktu         : 01:04:50',
    'Periode PIN   : 41536',
    'PIN saat ini  : 714502',
    '================================',
  ];

  let testState: ParcelBoxState = {
    ...mockBaseState,
  };

  for (const line of serialDump) {
    const parsed = parseAnySerialLine(line);
    if (parsed) {
      const res = processESP32Message(testState, parsed);
      testState = res.nextState;
    }
  }

  // Verify IP and network are recorded
  assert.equal(testState.wifiConfig.ip, '10.86.29.138');
  assert.equal(testState.wifiConfig.ssid, 'AAA');
  assert.equal(testState.wifiConfig.gateway, '10.86.29.155');
  assert.equal(testState.wifiConfig.subnet, '255.255.255.0');
  assert.equal(testState.wifiConfig.autoDetectedFromSerial, true);
  assert.equal(testState.wifiRssi, -16);

  // Verify PIN & Time
  assert.equal(testState.pin, '714502');
  assert.equal(testState.period, 41536);
  assert.equal(testState.pinStatus, 'ACTIVE');
  assert.equal(testState.date, '11/11/2026');
  assert.equal(testState.time, '01:04:50');
  assert.equal(testState.rtcStatus, 'OK');
});
