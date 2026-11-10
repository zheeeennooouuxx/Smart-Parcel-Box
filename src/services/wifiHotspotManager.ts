/**
 * WiFi Hotspot & Local Network Manager for ESP32
 * Handles HTTP REST Polling, WebSocket stream, and Virtual Hotspot Simulation.
 */

import { parseAnySerialLine } from './serialParser';
import { ESP32Message, SerialConnectionStatus, WifiConfig } from '../types/serial';

export interface WifiHotspotCallbacks {
  onStatusChange: (status: SerialConnectionStatus, errorMsg?: string) => void;
  onDataReceived: (rawLine: string, message: ESP32Message | null, byteCount: number) => void;
  onDataSent?: (rawText: string) => void;
  onWifiInfo?: (info: { ip: string; ssid: string; rssi?: number }) => void;
}

export class WifiHotspotManager {
  private callbacks: WifiHotspotCallbacks;
  private config: WifiConfig = {
    ip: '192.168.4.1',
    port: 80,
    ssid: 'AAA',
    password: '123456789',
    intervalMs: 2000,
    protocol: 'HTTP_POLL',
  };
  private isConnected: boolean = false;
  private isConnecting: boolean = false;
  private isSimulated: boolean = false;
  private pollIntervalId: ReturnType<typeof setInterval> | null = null;
  private ws: WebSocket | null = null;
  private abortController: AbortController | null = null;

  // Simulator state
  private simPeriod: number = 43821;
  private simPin: string = '084291';
  private simDoorState: 'CLOSED' | 'OPEN' = 'CLOSED';
  private simRtcOk: boolean = true;
  private consecutiveFailures: number = 0;

  constructor(callbacks: WifiHotspotCallbacks) {
    this.callbacks = callbacks;
  }

  public getConfig(): WifiConfig {
    return { ...this.config };
  }

  public setConfig(newConfig: Partial<WifiConfig>) {
    this.config = { ...this.config, ...newConfig };
  }

  public getIsConnected(): boolean {
    return this.isConnected;
  }

  public getIsSimulated(): boolean {
    return this.isSimulated;
  }

  /**
   * Test Ping to ESP32 Hotspot
   */
  public async testPing(customConfig?: WifiConfig): Promise<{
    success: boolean;
    latencyMs?: number;
    error?: string;
    details?: string;
  }> {
    const cfg = customConfig || this.config;
    const startTime = performance.now();

    if (this.isSimulated) {
      await new Promise((r) => setTimeout(r, 65));
      return {
        success: true,
        latencyMs: 65,
        details: `Virtual Hotspot ${cfg.ssid} (${cfg.ip}:${cfg.port}) aktif dan merespons HTTP 200 OK.`,
      };
    }

    const cleanIp = cfg.ip.trim().replace(/^https?:\/\//, '').replace(/\/$/, '');
    const url = `http://${cleanIp}:${cfg.port}/api/status`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);

      const res = await fetch(url, {
        method: 'GET',
        headers: { 'Accept': 'application/json, text/plain, */*' },
        signal: controller.signal,
        mode: 'cors',
      });

      clearTimeout(timeoutId);
      const latencyMs = Math.round(performance.now() - startTime);

      if (res.ok) {
        return {
          success: true,
          latencyMs,
          details: `Berhasil terhubung ke ESP32 Hotspot di ${url} (Latency: ${latencyMs}ms)`,
        };
      } else {
        return {
          success: false,
          latencyMs,
          error: `ESP32 merespons kode status HTTP ${res.status} (${res.statusText})`,
        };
      }
    } catch (err: unknown) {
      const error = err as Error;
      const isMixedContent = typeof window !== 'undefined' && window.location.protocol === 'https:' && !cfg.ip.startsWith('https');

      let explanation = error.message;
      if (error.name === 'AbortError') {
        explanation = 'Request Timeout (3500ms). Pastikan komputer/HP Anda sudah tersambung ke WiFi Hotspot ESP32.';
      } else if (isMixedContent) {
        explanation = 'Browser memblokir HTTP lokal dari HTTPS (Mixed Content). Jalankan di http://localhost:3000, ubah izin Insecure Content pada ikon gembok browser, atau aktifkan mode Simulasi Virtual Hotspot.';
      } else if (explanation.includes('Failed to fetch') || explanation.includes('NetworkError')) {
        explanation = `Tidak dapat menjangkau ${url}. Pastikan perangkat Anda terhubung ke WiFi "${cfg.ssid}" dan IP "${cleanIp}" sudah benar.`;
      }

      return {
        success: false,
        error: explanation,
      };
    }
  }

  /**
   * Connect to ESP32 WiFi Hotspot
   */
  public async connect(wifiConfig?: WifiConfig, simulated: boolean = false): Promise<boolean> {
    if (wifiConfig) {
      this.config = { ...this.config, ...wifiConfig };
    }
    this.isSimulated = simulated;
    this.consecutiveFailures = 0;

    this.callbacks.onStatusChange('CONNECTING');
    this.isConnecting = true;

    const cleanIp = this.config.ip.trim().replace(/^https?:\/\//, '').replace(/\/$/, '');
    this.callbacks.onWifiInfo?.({
      ip: cleanIp,
      ssid: this.config.ssid,
      rssi: this.isSimulated ? -45 : undefined,
    });

    if (this.isSimulated) {
      this.startSimulation();
      return true;
    }

    if (this.config.protocol === 'WEBSOCKET') {
      return this.connectWebSocket(cleanIp);
    } else {
      return this.startHttpPolling(cleanIp);
    }
  }

  /**
   * HTTP REST Polling connection loop
   */
  private async startHttpPolling(cleanIp: string): Promise<boolean> {
    this.stopPolling();

    // Initial check
    const initialOk = await this.pollStatus(cleanIp);
    if (!initialOk) {
      // If first poll fails, keep trying in background up to 3 times before setting ERROR
      this.callbacks.onStatusChange('CONNECTING', 'Menunggu respons awal dari ESP32 Hotspot...');
    }

    this.pollIntervalId = setInterval(async () => {
      await this.pollStatus(cleanIp);
    }, Math.max(1000, this.config.intervalMs || 2000));

    return true;
  }

  private async pollStatus(cleanIp: string): Promise<boolean> {
    const url = `http://${cleanIp}:${this.config.port}/api/status`;
    this.abortController = new AbortController();
    const timeoutId = setTimeout(() => this.abortController?.abort(), 3500);

    try {
      const res = await fetch(url, {
        method: 'GET',
        headers: { 'Accept': 'application/json, text/plain, */*' },
        signal: this.abortController.signal,
        mode: 'cors',
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const text = await res.text();
        const parsed = parseAnySerialLine(text);
        const byteCount = text.length;

        this.consecutiveFailures = 0;
        if (!this.isConnected) {
          this.isConnected = true;
          this.isConnecting = false;
          this.callbacks.onStatusChange('CONNECTED');
        }

        this.callbacks.onDataReceived(`[HTTP GET 200] ${text}`, parsed, byteCount);
        return true;
      } else {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
    } catch (err: unknown) {
      clearTimeout(timeoutId);
      const error = err as Error;
      this.consecutiveFailures++;

      if (this.consecutiveFailures >= 4) {
        this.isConnected = false;
        this.isConnecting = false;
        const msg = error.name === 'AbortError'
          ? 'Koneksi ke WiFi Hotspot ESP32 timeout.'
          : `Gagal membaca telemetri WiFi: ${error.message}`;
        this.callbacks.onStatusChange('ERROR', msg);
      }
      return false;
    }
  }

  /**
   * WebSocket stream connection
   */
  private connectWebSocket(cleanIp: string): boolean {
    try {
      const wsUrl = `ws://${cleanIp}:${this.config.port}/ws`;
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.isConnected = true;
        this.isConnecting = false;
        this.callbacks.onStatusChange('CONNECTED');
        this.callbacks.onDataReceived(
          `[WS CONNECTED] Terhubung ke WebSocket stream ${wsUrl}`,
          { type: 'INFO', message: 'WebSocket Hotspot Connected' },
          50
        );
        // Request initial status
        this.send('STATUS');
      };

      this.ws.onmessage = (event) => {
        const dataStr = String(event.data || '');
        const parsed = parseAnySerialLine(dataStr);
        this.callbacks.onDataReceived(`[WS RX] ${dataStr}`, parsed, dataStr.length);
      };

      this.ws.onerror = (err) => {
        this.callbacks.onStatusChange('ERROR', 'WebSocket error pada koneksi WiFi Hotspot.');
      };

      this.ws.onclose = () => {
        if (this.isConnected) {
          this.isConnected = false;
          this.callbacks.onStatusChange('DISCONNECTED');
        }
      };

      return true;
    } catch (err: unknown) {
      const error = err as Error;
      this.callbacks.onStatusChange('ERROR', `Gagal inisialisasi WebSocket: ${error.message}`);
      return false;
    }
  }

  /**
   * Send command over WiFi Hotspot
   */
  public async send(command: string): Promise<boolean> {
    const trimmed = command.trim();
    if (!trimmed) return false;

    if (this.isSimulated) {
      this.callbacks.onDataSent?.(`[WIFI TX] ${trimmed}`);
      setTimeout(() => {
        this.processSimulatedCommand(trimmed);
      }, 70);
      return true;
    }

    if (!this.isConnected && !this.isConnecting) {
      throw new Error('Belum terhubung ke WiFi Hotspot ESP32.');
    }

    const cleanIp = this.config.ip.trim().replace(/^https?:\/\//, '').replace(/\/$/, '');

    // WebSocket send
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(trimmed);
      this.callbacks.onDataSent?.(`[WS TX] ${trimmed}`);
      return true;
    }

    // HTTP POST / GET send
    try {
      const url = `http://${cleanIp}:${this.config.port}/api/command`;
      this.callbacks.onDataSent?.(`[HTTP POST] ${url} -> ${trimmed}`);

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cmd: trimmed }),
        mode: 'cors',
      });

      if (res.ok) {
        const replyText = await res.text();
        const parsed = parseAnySerialLine(replyText);
        this.callbacks.onDataReceived(`[HTTP 200 REPLY] ${replyText}`, parsed, replyText.length);
        return true;
      } else {
        throw new Error(`HTTP Error ${res.status}`);
      }
    } catch (err: unknown) {
      const error = err as Error;
      throw new Error(`Gagal mengirim perintah via WiFi: ${error.message}`);
    }
  }

  /**
   * Disconnect cleanly
   */
  public disconnect(): void {
    this.stopPolling();
    this.stopSimulation();

    if (this.ws) {
      try {
        this.ws.close();
      } catch {
        // ignore
      }
      this.ws = null;
    }

    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }

    this.isConnected = false;
    this.isConnecting = false;
    this.callbacks.onStatusChange('DISCONNECTED');
  }

  private stopPolling(): void {
    if (this.pollIntervalId) {
      clearInterval(this.pollIntervalId);
      this.pollIntervalId = null;
    }
  }

  /**
   * Virtual WiFi Hotspot Simulator Mode
   */
  public startSimulation(initialPeriod: number = 43821, initialPin: string = '084291'): void {
    this.isSimulated = true;
    this.simPeriod = initialPeriod;
    this.simPin = initialPin;
    this.simDoorState = 'CLOSED';
    this.simRtcOk = true;

    this.callbacks.onWifiInfo?.({
      ip: '192.168.4.1',
      ssid: this.config.ssid || 'SMART-PARCEL-BOX-AP',
      rssi: -42,
    });

    this.callbacks.onStatusChange('CONNECTING');

    setTimeout(() => {
      if (!this.isSimulated) return;
      this.isConnected = true;
      this.isConnecting = false;
      this.callbacks.onStatusChange('CONNECTED');

      this.emitSimulatedPacket({
        type: 'STATUS',
        rtc: 'OK',
        date: new Date().toISOString().slice(0, 10),
        time: new Date().toTimeString().slice(0, 8),
        period: this.simPeriod,
        pin: this.simPin,
        door: this.simDoorState,
      });
    }, 350);

    // Periodic telemetry every 2.5 seconds
    this.pollIntervalId = setInterval(() => {
      if (!this.isSimulated || !this.isConnected) return;

      const now = new Date();
      const timeStr = now.toTimeString().slice(0, 8);
      const dateStr = now.toISOString().slice(0, 10);

      if (!this.simRtcOk) {
        this.emitSimulatedPacket({
          type: 'ERROR',
          rtc: 'ERROR',
          message: 'RTC DS1302 NOT READY / BATTERY LOW',
        });
        return;
      }

      this.emitSimulatedPacket({
        type: 'STATUS',
        rtc: 'OK',
        date: dateStr,
        time: timeStr,
        period: this.simPeriod,
        pin: this.simPin,
        door: this.simDoorState,
      });
    }, 2500);
  }

  public stopSimulation(): void {
    this.isSimulated = false;
    this.stopPolling();
  }

  public simulateDoorToggle(newDoorState: 'OPEN' | 'CLOSED'): void {
    if (!this.isSimulated) return;
    this.simDoorState = newDoorState;
    this.emitSimulatedPacket({
      type: 'DOOR',
      door: newDoorState,
    });
  }

  public simulateRtcError(): void {
    if (!this.isSimulated) return;
    this.simRtcOk = false;
    this.emitSimulatedPacket({
      type: 'ERROR',
      rtc: 'ERROR',
      message: 'RTC DS1302 NOT READY / BATTERY LOW',
    });
  }

  public simulateNewPeriod(newPeriod: number, newPin: string): void {
    if (!this.isSimulated) return;
    this.simPeriod = newPeriod;
    this.simPin = newPin;
    const now = new Date();
    this.emitSimulatedPacket({
      type: 'STATUS',
      rtc: 'OK',
      date: now.toISOString().slice(0, 10),
      time: now.toTimeString().slice(0, 8),
      period: newPeriod,
      pin: newPin,
      door: this.simDoorState,
    });
  }

  private emitSimulatedPacket(data: ESP32Message): void {
    const jsonStr = JSON.stringify(data);
    const line = `[HOTSPOT HTTP 200] ${jsonStr}`;
    this.callbacks.onDataReceived(line, data, jsonStr.length + 20);
  }

  private processSimulatedCommand(cmd: string): void {
    const upper = cmd.toUpperCase().trim();
    const now = new Date();

    const pinMatch = cmd.match(/(?:PIN|SET_PIN|SET\s*PIN)\s*[:=]?\s*([0-9]{4,8})/i);
    if (pinMatch && pinMatch[1]) {
      this.simPin = pinMatch[1].padStart(6, '0').slice(-6);
      this.emitSimulatedPacket({
        type: 'STATUS',
        rtc: this.simRtcOk ? 'OK' : 'ERROR',
        date: now.toISOString().slice(0, 10),
        time: now.toTimeString().slice(0, 8),
        period: this.simPeriod,
        pin: this.simPin,
        door: this.simDoorState,
        message: `PIN AKTIF BARU: ${this.simPin}`,
      });
      return;
    }

    if (upper === 'PING') {
      this.emitSimulatedPacket({ type: 'PONG', message: 'ESP32 WIFI HOTSPOT ALIVE & RESPONSIVE' });
    } else if (upper === 'STATUS' || upper === 'PIN' || upper === 'GET_PIN' || upper === 'GET PIN') {
      this.emitSimulatedPacket({
        type: 'STATUS',
        rtc: this.simRtcOk ? 'OK' : 'ERROR',
        date: now.toISOString().slice(0, 10),
        time: now.toTimeString().slice(0, 8),
        period: this.simPeriod,
        pin: this.simPin,
        door: this.simDoorState,
      });
    } else if (upper === 'DOOR_OPEN' || upper === 'OPEN') {
      this.simulateDoorToggle('OPEN');
    } else if (upper === 'DOOR_CLOSED' || upper === 'CLOSE') {
      this.simulateDoorToggle('CLOSED');
    } else if (upper.includes('BEEP')) {
      this.emitSimulatedPacket({ type: 'ACK', message: 'BEEP BUZZER EXECUTED OVER WIFI' });
    } else {
      this.emitSimulatedPacket({ type: 'ACK', message: `WIFI CMD RECEIVED: ${cmd}` });
    }
  }
}
