/**
 * Web Serial Manager
 * Handles hardware serial connection via Chrome/Edge Web Serial API.
 */

import { LineBufferAccumulator, parseSerialJsonLine } from './serialParser';
import { ESP32Message, SerialConnectionStatus, LineEndingType } from '../types/serial';

export interface WebSerialCallbacks {
  onStatusChange: (status: SerialConnectionStatus, errorMsg?: string) => void;
  onDataReceived: (rawLine: string, message: ESP32Message | null, byteCount: number) => void;
  onDataSent?: (rawText: string) => void;
  onPortSelected: (portInfo: string) => void;
}

export class WebSerialManager {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private port: any = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private reader: any = null;
  private accumulator = new LineBufferAccumulator();
  private keepReading = false;
  private callbacks: WebSerialCallbacks;
  private currentBaudRate: number = 9600;
  private simulationIntervalId: ReturnType<typeof setInterval> | null = null;
  private isSimulated = false;

  constructor(callbacks: WebSerialCallbacks) {
    this.callbacks = callbacks;
    this.bindHardwareEvents();
  }

  public static isSupported(): boolean {
    return typeof navigator !== 'undefined' && 'serial' in navigator;
  }

  private bindHardwareEvents() {
    if (typeof navigator !== 'undefined' && 'serial' in navigator) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (navigator as any).serial.addEventListener('disconnect', (event: any) => {
        if (this.port && event.target === this.port) {
          this.handleUnexpectedDisconnect('Kabel USB ESP32 terputus atau dicabut.');
        }
      });
    }
  }

  /**
   * Connect to an ESP32 via Web Serial API
   */
  public async connect(baudRate: number = 9600): Promise<boolean> {
    if (!WebSerialManager.isSupported()) {
      this.callbacks.onStatusChange(
        'ERROR',
        'Browser tidak mendukung Web Serial API. Gunakan Google Chrome atau Microsoft Edge.'
      );
      return false;
    }

    try {
      this.currentBaudRate = baudRate;
      this.callbacks.onStatusChange('CONNECTING');

      // 1. Request port selection prompt from browser
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const navSerial = (navigator as any).serial;
      this.port = await navSerial.requestPort();

      if (!this.port) {
        this.callbacks.onStatusChange('DISCONNECTED');
        return false;
      }

      // Try to get info (USB vendorId/productId if available)
      const info = this.port.getInfo ? this.port.getInfo() : {};
      const portName = info.usbVendorId
        ? `ESP32 COM (VID: 0x${info.usbVendorId.toString(16)}, PID: 0x${(info.usbProductId || 0).toString(16)})`
        : 'ESP32 Serial Port';
      this.callbacks.onPortSelected(portName);

      // 2. Open serial port with baudRate 9600
      await this.port.open({
        baudRate: this.currentBaudRate,
        dataBits: 8,
        stopBits: 1,
        parity: 'none',
        bufferSize: 4096,
        flowControl: 'none',
      });

      this.accumulator.reset();
      this.keepReading = true;

      // 3. Start background reading stream
      this.startReadingLoop();

      return true;
    } catch (err: unknown) {
      const error = err as Error;
      // User cancelled port selection
      if (error.name === 'NotFoundError') {
        this.callbacks.onStatusChange('DISCONNECTED');
        return false;
      }
      this.callbacks.onStatusChange('ERROR', error.message || 'Gagal membuka port serial.');
      await this.disconnect();
      return false;
    }
  }

  /**
   * Stream reading loop
   */
  private async startReadingLoop() {
    if (!this.port || !this.port.readable) return;

    try {
      const textDecoder = new TextDecoder();
      this.reader = this.port.readable.getReader();

      while (this.keepReading) {
        const { value, done } = await this.reader.read();
        if (done) {
          break;
        }

        if (value) {
          const chunkStr = textDecoder.decode(value, { stream: true });
          const byteLength = value.byteLength || chunkStr.length;
          const completeLines = this.accumulator.push(chunkStr);

          for (const line of completeLines) {
            const parsed = parseSerialJsonLine(line);
            this.callbacks.onDataReceived(line, parsed, byteLength);
          }
        }
      }
    } catch (err: unknown) {
      const error = err as Error;
      if (this.keepReading) {
        this.handleUnexpectedDisconnect(`Kesalahan serial stream: ${error.message || 'Data error'}`);
      }
    } finally {
      if (this.reader) {
        try {
          this.reader.releaseLock();
        } catch {
          // ignore
        }
        this.reader = null;
      }
    }
  }

  /**
   * Disconnect the serial port cleanly
   */
  public async disconnect(): Promise<void> {
    this.stopSimulation();
    this.keepReading = false;

    if (this.reader) {
      try {
        await this.reader.cancel();
      } catch {
        // ignore
      }
      try {
        this.reader.releaseLock();
      } catch {
        // ignore
      }
      this.reader = null;
    }

    if (this.port) {
      try {
        await this.port.close();
      } catch {
        // ignore
      }
      this.port = null;
    }

    this.accumulator.reset();
    this.callbacks.onStatusChange('DISCONNECTED');
  }

  private handleUnexpectedDisconnect(reason: string) {
    this.keepReading = false;
    this.accumulator.reset();
    if (this.port) {
      try {
        this.port.close();
      } catch {
        // ignore
      }
      this.port = null;
    }
    this.callbacks.onStatusChange('ERROR', reason);
  }

  private simPeriod: number = 43821;
  private simPin: string = '084291';
  private simDoorState: 'CLOSED' | 'OPEN' = 'CLOSED';
  private simRtcOk: boolean = true;

  /**
   * Simulation mode: for testing/demonstration when no hardware ESP32 is plugged in.
   * Emits formatted JSON lines simulating the exact ESP32 firmware output.
   */
  public startSimulation(initialPeriod: number = 43821, initialPin: string = '084291'): void {
    this.isSimulated = true;
    this.simPeriod = initialPeriod;
    this.simPin = initialPin;
    this.simDoorState = 'CLOSED';
    this.simRtcOk = true;

    this.callbacks.onPortSelected('Virtual ESP32 Simulator (USB COM3)');
    this.callbacks.onStatusChange('CONNECTING');

    // Send first status packet after 400ms to simulate connection handshake
    setTimeout(() => {
      if (!this.isSimulated) return;
      this.emitSimulatedPacket({
        type: 'STATUS',
        rtc: 'OK',
        date: new Date().toISOString().slice(0, 10),
        time: new Date().toTimeString().slice(0, 8),
        period: this.simPeriod,
        pin: this.simPin,
        door: this.simDoorState,
      });
    }, 400);

    // Periodic telemetry every 3 seconds
    this.simulationIntervalId = setInterval(() => {
      if (!this.isSimulated) return;

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
    }, 3000);
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
    const line = jsonStr;
    this.callbacks.onDataReceived(line, data, jsonStr.length + 2);
  }

  public stopSimulation(): void {
    this.isSimulated = false;
    if (this.simulationIntervalId) {
      clearInterval(this.simulationIntervalId);
      this.simulationIntervalId = null;
    }
  }

  public getIsSimulated(): boolean {
    return this.isSimulated;
  }

  /**
   * Send data to ESP32 via Web Serial or Virtual Simulator
   */
  public async send(text: string, ending: LineEndingType = 'NL'): Promise<boolean> {
    let suffix = '';
    switch (ending) {
      case 'NL': suffix = '\n'; break;
      case 'CR': suffix = '\r'; break;
      case 'NL_CR': suffix = '\r\n'; break;
      case 'NONE': suffix = ''; break;
    }
    const fullMessage = text + suffix;

    if (this.isSimulated) {
      this.callbacks.onDataSent?.(fullMessage);
      setTimeout(() => {
        this.processSimulatedCommand(text.trim());
      }, 80);
      return true;
    }

    if (!this.port || !this.port.writable) {
      throw new Error('Port serial belum terhubung atau tidak dapat ditulis.');
    }

    try {
      const encoder = new TextEncoder();
      const writer = this.port.writable.getWriter();
      await writer.write(encoder.encode(fullMessage));
      writer.releaseLock();
      this.callbacks.onDataSent?.(fullMessage);
      return true;
    } catch (err: unknown) {
      const error = err as Error;
      throw new Error(`Gagal mengirim data serial: ${error.message || 'Write error'}`);
    }
  }

  /**
   * Hardware Reset via DTR/RTS lines toggle
   */
  public async resetDevice(): Promise<boolean> {
    if (this.isSimulated) {
      this.callbacks.onDataReceived('--- ESP32 HARDWARE REBOOT TRIGGERED (RST PIN LOW -> HIGH) ---', null, 50);
      setTimeout(() => {
        this.callbacks.onDataReceived('rst:0x1 (POWERON_RESET),boot:0x13 (SPI_FAST_FLASH_BOOT)', null, 60);
        this.callbacks.onDataReceived('Smart Parcel Box ESP32 Firmware Ready. UART2 link active.', null, 55);
      }, 300);
      return true;
    }

    if (!this.port) return false;
    try {
      if (typeof this.port.setSignals === 'function') {
        await this.port.setSignals({ dataTerminalReady: false, requestToSend: true });
        await new Promise((r) => setTimeout(r, 150));
        await this.port.setSignals({ dataTerminalReady: true, requestToSend: false });
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  private processSimulatedCommand(cmd: string): void {
    const upper = cmd.toUpperCase();
    if (upper === 'PING') {
      this.emitSimulatedPacket({ type: 'PONG', message: 'ESP32 HARDWARE ALIVE & RESPONSIVE' });
    } else if (upper === 'STATUS') {
      const now = new Date();
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
      this.emitSimulatedPacket({ type: 'ACK', message: 'BEEP BUZZER EXECUTED' });
    } else if (upper === 'RESTART' || upper === 'RESET') {
      this.resetDevice();
    } else {
      this.emitSimulatedPacket({ type: 'ACK', message: `CMD RECEIVED: ${cmd}` });
    }
  }
}
