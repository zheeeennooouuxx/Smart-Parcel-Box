/**
 * Type definitions for SMART PARCEL BOX DASHBOARD
 * Web Serial communication protocol and application state.
 */

export type SerialConnectionStatus = 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'ERROR';

export type DoorStatus = 'OPEN' | 'CLOSED' | 'UNKNOWN';

export type RTCStatus = 'OK' | 'ERROR' | 'UNKNOWN';

export type PINValidityStatus = 'ACTIVE' | 'EXPIRED' | 'INVALID' | 'WAITING_DEVICE';

export interface ESP32Message {
  type?: 'STATUS' | 'ERROR' | 'DOOR' | 'PIN' | 'RTC' | 'RAW' | string;
  rtc?: 'OK' | 'ERROR' | string;
  date?: string; // YYYY-MM-DD
  time?: string; // HH:mm:ss
  period?: number;
  pin?: string | number;
  door?: 'OPEN' | 'CLOSED' | string;
  message?: string;
  [key: string]: unknown;
}

export interface ParcelBoxState {
  connectionStatus: SerialConnectionStatus;
  portInfo?: string;
  baudRate: number;
  rtcStatus: RTCStatus;
  date?: string;
  time?: string;
  period?: number;
  pin?: string; // Always formatted as 6-digit string with leading zeros
  pinStatus: PINValidityStatus;
  doorStatus: DoorStatus;
  lastUpdated?: number;
  errorMessage?: string;
  rxPacketCount: number;
  rxBytesCount: number;
}

export type LogEventType = 
  | 'CONNECT'
  | 'DISCONNECT'
  | 'RTC_OK'
  | 'RTC_ERROR'
  | 'PIN_CHANGE'
  | 'DOOR_OPEN'
  | 'DOOR_CLOSED'
  | 'ERROR'
  | 'INFO';

export interface ActivityLog {
  id: string;
  timestamp: string; // ISO or formatted time
  type: LogEventType;
  message: string;
  details?: string;
}

export type SerialDirection = 'RX' | 'TX';

export type LineEndingType = 'NL' | 'CR' | 'NL_CR' | 'NONE';

export interface SerialLineEntry {
  id: string;
  time: string;
  raw: string;
  direction?: SerialDirection;
  parsed?: ESP32Message | null;
  error?: boolean;
}
