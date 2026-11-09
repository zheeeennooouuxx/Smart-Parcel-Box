import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatSixDigitPin,
  LineBufferAccumulator,
  parseSerialJsonLine,
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

test('processESP32Message updates state and logs for normal status and transitions to CONNECTED', () => {
  const initialState: ParcelBoxState = {
    connectionStatus: 'CONNECTING',
    baudRate: 9600,
    rtcStatus: 'UNKNOWN',
    pinStatus: 'WAITING_DEVICE',
    doorStatus: 'UNKNOWN',
    rxPacketCount: 0,
    rxBytesCount: 0,
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
    connectionStatus: 'CONNECTED',
    baudRate: 9600,
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
    connectionStatus: 'CONNECTED',
    baudRate: 9600,
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
