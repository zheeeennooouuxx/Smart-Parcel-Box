/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Header } from './components/Header';
import { Sidebar, ActiveTab } from './components/Sidebar';
import { PinCard } from './components/PinCard';
import { DoorCard } from './components/DoorCard';
import { RtcCard } from './components/RtcCard';
import { DeviceStatusCard } from './components/DeviceStatusCard';
import { PinAccessView } from './components/PinAccessView';
import { ActivityLogsView } from './components/ActivityLogsView';
import { Esp32GuideView } from './components/Esp32GuideView';
import { SettingsView } from './components/SettingsView';
import { SerialMonitorView } from './components/SerialMonitorView';
import { 
  ParcelBoxState, 
  ActivityLog, 
  SerialLineEntry, 
  SerialConnectionStatus, 
  ESP32Message,
  LineEndingType,
  ConnectionType,
  WifiConfig
} from './types/serial';
import { processESP32Message, parseAnySerialLine } from './services/serialParser';
import { WebSerialManager } from './services/webSerialManager';
import { WifiHotspotManager } from './services/wifiHotspotManager';
import { AlertTriangle, X, Usb, CheckCircle2, ExternalLink, HelpCircle, Radio, Wifi } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [baudRate, setBaudRate] = useState<number>(9600);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [isSimulated, setIsSimulated] = useState<boolean>(false);
  const [alertBanner, setAlertBanner] = useState<{ message: string; type: 'error' | 'warning' | 'info' } | null>(null);
  const [newDeviceBanner, setNewDeviceBanner] = useState<boolean>(true);
  const [showConnectHelpModal, setShowConnectHelpModal] = useState<boolean>(false);

  // Detect if running inside an iframe preview
  const isIframe = typeof window !== 'undefined' && window.self !== window.top;
  const isSerialSupported = WebSerialManager.isSupported();

  // Core application state
  const [state, setState] = useState<ParcelBoxState>({
    connectionStatus: 'DISCONNECTED',
    connectionType: 'SERIAL',
    portInfo: 'COM4',
    baudRate: 9600,
    chipInfo: 'ESP32-D0WD-V3 (rev v3.1)',
    macAddress: 'f4:65:0b:57:13:bc',
    wifiConfig: {
      ip: '192.168.4.1',
      port: 80,
      ssid: 'AAA',
      password: '123456789',
      intervalMs: 2000,
      protocol: 'HTTP_POLL',
    },
    rtcStatus: 'UNKNOWN',
    pinStatus: 'WAITING_DEVICE',
    doorStatus: 'UNKNOWN',
    rxPacketCount: 0,
    rxBytesCount: 0,
  });

  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [rawLines, setRawLines] = useState<SerialLineEntry[]>([]);

  // Refs to hold hardware manager instances
  const serialManagerRef = useRef<WebSerialManager | null>(null);
  const wifiManagerRef = useRef<WifiHotspotManager | null>(null);

  // Web Audio chime generator
  const playChime = useCallback((type: 'door' | 'alert' | 'connect') => {
    if (!soundEnabled || typeof window === 'undefined') return;
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.connect(gain);
      gain.connect(ctx.destination);

      const now = ctx.currentTime;
      if (type === 'door') {
        osc.frequency.setValueAtTime(587.33, now); // D5
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.15); // A5
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
        osc.start(now);
        osc.stop(now + 0.3);
      } else if (type === 'connect') {
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(659.25, now + 0.12);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
        osc.start(now);
        osc.stop(now + 0.25);
      }
    } catch {
      // Audio not permitted or failed
    }
  }, [soundEnabled]);

  // Connection event handlers
  const handleStatusChange = useCallback((newStatus: SerialConnectionStatus, errorMsg?: string) => {
    setState((prev) => {
      let pinStatus = prev.pinStatus;
      if (newStatus === 'DISCONNECTED') {
        pinStatus = 'WAITING_DEVICE';
      }
      return {
        ...prev,
        connectionStatus: newStatus,
        pinStatus,
        errorMessage: errorMsg,
      };
    });

    if (errorMsg) {
      setAlertBanner({ message: errorMsg, type: 'error' });
      setLogs((prev) => [
        {
          id: `${Date.now()}-err`,
          timestamp: new Date().toISOString(),
          type: 'ERROR',
          message: errorMsg,
        },
        ...prev.slice(0, 499),
      ]);
    }

    if (newStatus === 'DISCONNECTED') {
      setIsSimulated(false);
      setLogs((prev) => [
        {
          id: `${Date.now()}-dc`,
          timestamp: new Date().toISOString(),
          type: 'DISCONNECT',
          message: 'Koneksi perangkat ESP32 terputus.',
        },
        ...prev.slice(0, 499),
      ]);
    } else if (newStatus === 'CONNECTED') {
      playChime('connect');
      setAlertBanner(null);
    }
  }, [playChime]);

  const handleDataReceived = useCallback((rawLine: string, message: ESP32Message | null, byteCount: number) => {
    const now = new Date();
    const timeFormatted = now.toTimeString().slice(0, 8);
    const parsedMessage: ESP32Message = message || parseAnySerialLine(rawLine) || { type: 'RAW', message: rawLine };

    // Append to raw lines with direction: 'RX'
    setRawLines((prev) => [
      {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        time: timeFormatted,
        raw: rawLine,
        direction: 'RX',
        parsed: parsedMessage,
        error: false,
      },
      ...prev.slice(0, 499),
    ]);

    setState((prevState) => {
      const { nextState, newLogs } = processESP32Message(prevState, parsedMessage, now.toISOString());
      
      // Update byte counter
      nextState.rxBytesCount = prevState.rxBytesCount + byteCount;

      // Check for door transition sound
      if (nextState.doorStatus !== prevState.doorStatus && prevState.doorStatus !== 'UNKNOWN') {
        playChime('door');
      }

      if (newLogs.length > 0) {
        setLogs((prevLogs) => [...newLogs, ...prevLogs].slice(0, 499));
      }

      // If a new WiFi IP was detected from Serial, notify user with quick switch action
      if (parsedMessage.wifiIp && parsedMessage.wifiIp !== prevState.wifiConfig.ip) {
        setAlertBanner({
          message: `Alamat IP ESP32 Tercatat: ${parsedMessage.wifiIp} (SSID: ${parsedMessage.wifiSsid || prevState.wifiConfig.ssid || 'AAA'}). Konfigurasi WiFi Hotspot otomatis diperbarui!`,
          type: 'info',
        });
      }

      return nextState;
    });
  }, [playChime]);

  const handleDataSent = useCallback((rawText: string) => {
    const now = new Date();
    const timeFormatted = now.toTimeString().slice(0, 8);

    // Append to raw lines with direction: 'TX'
    setRawLines((prev) => [
      {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        time: timeFormatted,
        raw: rawText.replace(/[\r\n]+$/, ''),
        direction: 'TX',
        error: false,
      },
      ...prev.slice(0, 499),
    ]);
  }, []);

  const handlePortSelected = useCallback((portName: string) => {
    setState((prev) => ({ ...prev, portInfo: portName }));
  }, []);

  // Initialize WebSerialManager
  useEffect(() => {
    const manager = new WebSerialManager({
      onStatusChange: handleStatusChange,
      onDataReceived: handleDataReceived,
      onDataSent: handleDataSent,
      onPortSelected: handlePortSelected,
    });
    serialManagerRef.current = manager;

    return () => {
      manager.disconnect();
    };
  }, [handleStatusChange, handleDataReceived, handleDataSent, handlePortSelected]);

  // Initialize WifiHotspotManager
  useEffect(() => {
    const wifiManager = new WifiHotspotManager({
      onStatusChange: handleStatusChange,
      onDataReceived: handleDataReceived,
      onDataSent: handleDataSent,
      onWifiInfo: (info) => {
        setState((prev) => ({
          ...prev,
          portInfo: `WiFi: ${info.ssid} (${info.ip})`,
          wifiRssi: info.rssi,
        }));
      },
    });
    wifiManagerRef.current = wifiManager;

    return () => {
      wifiManager.disconnect();
    };
  }, [handleStatusChange, handleDataReceived, handleDataSent]);

  // Send message to serial port or WiFi Hotspot
  const handleSendMessage = async (text: string, ending: LineEndingType): Promise<boolean> => {
    if (state.connectionType === 'WIFI') {
      if (!wifiManagerRef.current) return false;
      return await wifiManagerRef.current.send(text);
    } else {
      if (!serialManagerRef.current) return false;
      return await serialManagerRef.current.send(text, ending);
    }
  };

  // Hardware Reset ESP32
  const handleResetDevice = async (): Promise<boolean> => {
    if (state.connectionType === 'WIFI') {
      if (!wifiManagerRef.current) return false;
      return await wifiManagerRef.current.send('RESET');
    } else {
      if (!serialManagerRef.current) return false;
      return await serialManagerRef.current.resetDevice();
    }
  };

  // Connect explicitly via USB Serial (guaranteed COM port connect)
  const handleConnectSerial = async () => {
    setAlertBanner(null);
    wifiManagerRef.current?.disconnect();
    setState((prev) => ({
      ...prev,
      connectionType: 'SERIAL',
      connectionStatus: 'CONNECTING',
      portInfo: 'COM4',
    }));
    if (!serialManagerRef.current) return;
    await serialManagerRef.current.connect(baudRate);
  };

  // Connect Handler (USB Serial vs WiFi Hotspot)
  const handleConnect = async () => {
    setAlertBanner(null);
    if (state.connectionType === 'WIFI') {
      if (!wifiManagerRef.current) return;
      await wifiManagerRef.current.connect(state.wifiConfig, isSimulated);
    } else {
      await handleConnectSerial();
    }
  };

  // Disconnect Handler
  const handleDisconnect = async () => {
    if (state.connectionType === 'WIFI') {
      wifiManagerRef.current?.disconnect();
    } else {
      await serialManagerRef.current?.disconnect();
    }
    setIsSimulated(false);
  };

  // Switch connection type
  const handleConnectionTypeChange = (newType: ConnectionType) => {
    if (state.connectionStatus === 'CONNECTED' || state.connectionStatus === 'CONNECTING') {
      handleDisconnect();
    }
    setState((prev) => ({
      ...prev,
      connectionType: newType,
      connectionStatus: 'DISCONNECTED',
      pinStatus: 'WAITING_DEVICE',
      portInfo: newType === 'WIFI' ? `WiFi: ${prev.wifiConfig.ssid}` : undefined,
    }));
  };

  // Switch to WiFi Hotspot mode with recorded IP
  const handleSwitchToWifi = async (targetIp?: string) => {
    setAlertBanner(null);
    const effectiveIp = targetIp || state.wifiConfig.ip;
    if (effectiveIp) {
      handleWifiConfigChange({ ip: effectiveIp });
    }
    await handleDisconnect();
    handleConnectionTypeChange('WIFI');
    // Connect to WiFi
    setTimeout(async () => {
      if (wifiManagerRef.current) {
        await wifiManagerRef.current.connect(
          { ...state.wifiConfig, ip: effectiveIp || state.wifiConfig.ip },
          isSimulated
        );
      }
    }, 150);
  };

  // Update WiFi Config
  const handleWifiConfigChange = (newCfg: Partial<WifiConfig>) => {
    setState((prev) => ({
      ...prev,
      wifiConfig: { ...prev.wifiConfig, ...newCfg },
    }));
    wifiManagerRef.current?.setConfig(newCfg);
  };

  // Ping test
  const handleTestPingWifi = async () => {
    if (!wifiManagerRef.current) {
      return { success: false, error: 'WiFi Hotspot manager belum siap' };
    }
    return await wifiManagerRef.current.testPing(state.wifiConfig);
  };

  // Simulator Toggle
  const handleToggleSimulator = () => {
    if (isSimulated) {
      if (state.connectionType === 'WIFI') {
        wifiManagerRef.current?.stopSimulation();
      } else {
        serialManagerRef.current?.stopSimulation();
      }
      setIsSimulated(false);
      handleDisconnect();
    } else {
      setIsSimulated(true);
      if (state.connectionType === 'WIFI') {
        wifiManagerRef.current?.connect(state.wifiConfig, true);
      } else {
        serialManagerRef.current?.startSimulation(43821, '084291');
      }
    }
  };

  // Simulator controls
  const handleSimulateDoor = (doorState: 'OPEN' | 'CLOSED') => {
    if (isSimulated) {
      if (state.connectionType === 'WIFI') {
        wifiManagerRef.current?.simulateDoorToggle(doorState);
      } else {
        serialManagerRef.current?.simulateDoorToggle(doorState);
      }
    }
  };

  const handleSimulateRtcError = () => {
    if (isSimulated) {
      if (state.connectionType === 'WIFI') {
        wifiManagerRef.current?.simulateRtcError();
      } else {
        serialManagerRef.current?.simulateRtcError();
      }
    }
  };

  const handleSimulateNewPeriod = () => {
    if (isSimulated) {
      const nextPeriod = (state.period || 43821) + 1;
      const randomPin = Math.floor(100000 + Math.random() * 900000).toString();
      if (state.connectionType === 'WIFI') {
        wifiManagerRef.current?.simulateNewPeriod(nextPeriod, randomPin);
      } else {
        serialManagerRef.current?.simulateNewPeriod(nextPeriod, randomPin);
      }
    }
  };

  const handleBaudRateChange = (newRate: number) => {
    setBaudRate(newRate);
    setState((prev) => ({ ...prev, baudRate: newRate }));
  };

  const handleClearLogs = () => {
    setLogs([]);
    setRawLines([]);
  };

  return (
    <div className="min-h-screen bg-[#080d1a] text-slate-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-black">
      {/* Top Header */}
      <Header
        connectionStatus={state.connectionStatus}
        connectionType={state.connectionType}
        onConnectionTypeChange={handleConnectionTypeChange}
        rtcStatus={state.rtcStatus}
        portInfo={state.portInfo}
        baudRate={baudRate}
        wifiConfig={state.wifiConfig}
        onWifiConfigChange={handleWifiConfigChange}
        isSimulated={isSimulated}
        onConnect={handleConnect}
        onDisconnect={handleDisconnect}
        onToggleSimulator={handleToggleSimulator}
        onOpenSettings={() => setActiveTab('settings')}
        onOpenSerialMonitor={() => setActiveTab('monitor')}
        onTestPingWifi={handleTestPingWifi}
      />

      {/* Iframe Warning Banner (Web Serial requires top-level tab) */}
      {isIframe && (
        <div className="bg-gradient-to-r from-amber-950 via-slate-900 to-amber-950 border-b border-amber-500/50 px-4 py-2 text-xs font-mono-code text-amber-200 flex flex-wrap items-center justify-between gap-2 shadow-lg">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold font-tech tracking-wider border border-amber-500/30">
              PENTING: AKSES PORT USB SERIAL
            </span>
            <span>
              Aplikasi sedang dibuka dalam preview frame. Browser Chrome memerlukan Tab Baru agar dialog USB COM4 dapat dibuka.
            </span>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={typeof window !== 'undefined' ? window.location.href : '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3.5 py-1 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-tech font-bold text-xs tracking-wider flex items-center gap-1.5 shadow-md transition-all cursor-pointer"
            >
              <span>BUKA DI TAB BARU ↗</span>
            </a>
            <button
              onClick={() => setShowConnectHelpModal(true)}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs border border-slate-700 transition-all cursor-pointer"
            >
              Bantuan Koneksi
            </button>
          </div>
        </div>
      )}

      {/* Browser Support Warning Banner */}
      {!isSerialSupported && (
        <div className="bg-rose-950/90 border-b border-rose-800 px-4 py-2 text-xs font-mono-code text-rose-200 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>
              Browser ini tidak mendukung Web Serial API. Gunakan <strong>Google Chrome</strong> atau <strong>Microsoft Edge</strong> pada PC/Laptop.
            </span>
          </div>
          <button
            onClick={() => {
              setIsSimulated(true);
              serialManagerRef.current?.startSimulation(43821, '084291');
            }}
            className="px-3 py-1 rounded-lg bg-rose-800 hover:bg-rose-700 text-white font-tech font-bold text-xs cursor-pointer"
          >
            Aktifkan Mode Simulasi COM4
          </button>
        </div>
      )}

      {/* Alert Banner if active */}
      {alertBanner && (
        <div className={`px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs font-mono-code shadow-md ${
          alertBanner.type === 'error'
            ? 'bg-rose-950/90 border-b border-rose-800 text-rose-200'
            : alertBanner.type === 'info'
            ? 'bg-gradient-to-r from-blue-950/95 via-[#0b1c3b] to-slate-900 border-b border-cyan-500/50 text-cyan-200'
            : 'bg-amber-950/90 border-b border-amber-800 text-amber-200'
        }`}>
          <div className="flex items-center gap-2 max-w-2xl">
            {alertBanner.type === 'info' ? (
              <Wifi className="w-4 h-4 shrink-0 text-cyan-400 animate-pulse" />
            ) : (
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
            )}
            <span>
              {alertBanner.message.includes('Failed to fetch') || alertBanner.message.includes('timeout')
                ? 'Koneksi WiFi HTTP gagal karena firmware ESP32 mengirim data melalui USB Serial. Klik tombol di kanan untuk menghubungkan via COM4!'
                : alertBanner.message}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {alertBanner.type === 'info' ? (
              <button
                onClick={() => handleSwitchToWifi()}
                className="px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-400 hover:to-cyan-400 text-slate-950 font-bold font-tech text-xs tracking-wider transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
              >
                <Wifi className="w-3.5 h-3.5" />
                <span>BERALIH KE WIFI HOTSPOT ({state.wifiConfig.ip})</span>
              </button>
            ) : (
              <button
                onClick={handleConnectSerial}
                className="px-3 py-1 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold font-tech text-xs tracking-wider transition-all shadow-md flex items-center gap-1 cursor-pointer"
              >
                <Usb className="w-3.5 h-3.5" />
                <span>Gunakan USB Serial (COM4)</span>
              </button>
            )}
            <button
              onClick={() => setActiveTab('settings')}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs border border-slate-700 cursor-pointer"
            >
              Menu WiFi
            </button>
            <button
              onClick={() => setAlertBanner(null)}
              aria-label="Tutup Peringatan"
              className="p-1 hover:bg-black/30 rounded cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* New Device Ready Banner */}
      {state.connectionStatus === 'DISCONNECTED' && newDeviceBanner && (
        <div className="bg-gradient-to-r from-blue-950/90 via-[#0a1835] to-slate-900 border-b border-cyan-500/40 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs font-mono-code shadow-md">
          <div className="flex items-center gap-2.5">
            <span className="flex h-2.5 w-2.5 rounded-full bg-cyan-400 animate-pulse"></span>
            <span className="text-cyan-300 font-bold font-tech">PERANGKAT ESP32 BARU SIAP DIHUBUNGKAN:</span>
            <span className="text-slate-300">
              Port <strong>COM4</strong> • Chip: <strong>ESP32-D0WD-V3</strong> (MAC: <code className="text-cyan-300">f4:65:0b:57:13:bc</code>) @9600 Baud
            </span>
            <span className="text-amber-400 text-[11px] hidden xl:inline">
              (Tutup Serial Monitor Arduino IDE agar COM4 tidak terkunci)
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleConnectSerial}
              className="px-3.5 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold font-tech text-xs tracking-wider transition-all shadow-md shadow-cyan-500/25 flex items-center gap-1.5 cursor-pointer"
            >
              <Usb className="w-3.5 h-3.5" />
              <span>HUBUNGKAN COM4 SEKARANG</span>
            </button>
            <button
              onClick={() => setShowConnectHelpModal(true)}
              className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs border border-slate-700 cursor-pointer"
            >
              Panduan
            </button>
            <button
              onClick={() => setNewDeviceBanner(false)}
              aria-label="Tutup Banner Perangkat Baru"
              className="p-1 text-slate-400 hover:text-white rounded cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Main Container */}
      <div className="flex-1 flex flex-col lg:flex-row">
        {/* Sidebar */}
        <Sidebar
          activeTab={activeTab}
          onTabChange={setActiveTab}
          state={state}
        />

        {/* Dynamic Content Area */}
        <main className="flex-1 p-4 md:p-8 overflow-y-auto max-w-7xl mx-auto w-full">
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              {/* Primary Feature: PIN Card */}
              <PinCard 
                state={state} 
                onConnectClick={handleConnect} 
              />

              {/* Secondary Grid: Door Status & RTC DS1302 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <DoorCard
                  doorStatus={state.doorStatus}
                  lastUpdated={state.lastUpdated}
                />
                <RtcCard
                  rtcStatus={state.rtcStatus}
                  date={state.date}
                  time={state.time}
                  period={state.period}
                  errorMessage={state.errorMessage}
                />
              </div>

              {/* Hardware Telemetry & Communication Status */}
              <DeviceStatusCard state={state} />
            </div>
          )}

          {activeTab === 'pin-access' && (
            <PinAccessView
              state={state}
              onConnectClick={handleConnect}
            />
          )}

          {activeTab === 'device' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between pb-2">
                <h2 className="text-xl md:text-2xl font-bold text-white font-tech">
                  DIAGNOSTIK & MONITORING PERANGKAT
                </h2>
                <div className="text-xs text-cyan-400 font-mono-code">
                  {state.connectionType === 'WIFI' ? 'WIFI HOTSPOT SoftAP (802.11 b/g/n)' : 'UART2 GPIO16/17 • USB CDC'}
                </div>
              </div>
              <DeviceStatusCard state={state} />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <DoorCard doorStatus={state.doorStatus} lastUpdated={state.lastUpdated} />
                <RtcCard
                  rtcStatus={state.rtcStatus}
                  date={state.date}
                  time={state.time}
                  period={state.period}
                  errorMessage={state.errorMessage}
                />
              </div>
            </div>
          )}

          {activeTab === 'monitor' && (
            <SerialMonitorView
              lines={rawLines}
              connectionStatus={state.connectionStatus}
              connectionType={state.connectionType}
              wifiConfig={state.wifiConfig}
              portInfo={state.portInfo}
              baudRate={baudRate}
              pin={state.pin}
              period={state.period}
              onBaudRateChange={handleBaudRateChange}
              onSendMessage={handleSendMessage}
              onResetDevice={handleResetDevice}
              onClearLogs={handleClearLogs}
              onConnect={handleConnect}
              onDisconnect={handleDisconnect}
              onGoToPinAccess={() => setActiveTab('pin-access')}
              onSwitchToWifi={handleSwitchToWifi}
            />
          )}

          {activeTab === 'logs' && (
            <ActivityLogsView
              logs={logs}
              rawLines={rawLines}
              onClearLogs={handleClearLogs}
            />
          )}

          {activeTab === 'firmware' && (
            <Esp32GuideView />
          )}

          {activeTab === 'settings' && (
            <SettingsView
              connectionType={state.connectionType}
              onConnectionTypeChange={handleConnectionTypeChange}
              baudRate={baudRate}
              onBaudRateChange={handleBaudRateChange}
              wifiConfig={state.wifiConfig}
              onWifiConfigChange={handleWifiConfigChange}
              isSimulated={isSimulated}
              onToggleSimulator={handleToggleSimulator}
              onSimulateDoorToggle={handleSimulateDoor}
              onSimulateRtcError={handleSimulateRtcError}
              onSimulateNewPeriod={handleSimulateNewPeriod}
              soundEnabled={soundEnabled}
              onToggleSound={() => setSoundEnabled(!soundEnabled)}
              onTestPingWifi={handleTestPingWifi}
            />
          )}
        </main>
      </div>

      {/* Troubleshooting & Connection Help Modal */}
      {showConnectHelpModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0b1329] border border-cyan-500/40 rounded-3xl max-w-xl w-full p-6 space-y-5 shadow-2xl relative animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                  <Usb className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white font-tech tracking-wide">
                    PANDUAN KONEKSI ESP32 (COM4)
                  </h3>
                  <p className="text-xs text-slate-400 font-mono-code">
                    Solusi Mengatasi Port Terkunci & Gagal Terhubung
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowConnectHelpModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs font-mono-code">
              {/* Check 1: Arduino IDE Serial Monitor */}
              <div className="p-3.5 rounded-2xl bg-amber-950/30 border border-amber-500/40 space-y-2">
                <div className="flex items-center gap-2 text-amber-300 font-bold font-tech text-sm">
                  <span className="w-5 h-5 rounded-full bg-amber-500/30 flex items-center justify-center text-xs">1</span>
                  <span>TUTUP SERIAL MONITOR DI ARDUINO IDE</span>
                </div>
                <p className="text-slate-300 leading-relaxed text-[11px]">
                  Windows hanya mengizinkan <strong>1 aplikasi</strong> membuka port <strong>COM4</strong> dalam satu waktu. Jika jendela Serial Monitor di Arduino IDE masih aktif (atau sedang upload sketch), browser Chrome akan diblokir dengan pesan <em>"Failed to open serial port"</em>.
                </p>
                <div className="text-[11px] text-amber-400 font-semibold">
                  👉 Solusi: Tutup jendela Serial Monitor di Arduino IDE Anda sekarang.
                </div>
              </div>

              {/* Check 2: Iframe Browser Permission */}
              <div className="p-3.5 rounded-2xl bg-blue-950/30 border border-blue-500/40 space-y-2">
                <div className="flex items-center gap-2 text-cyan-300 font-bold font-tech text-sm">
                  <span className="w-5 h-5 rounded-full bg-blue-500/30 flex items-center justify-center text-xs">2</span>
                  <span>BUKA DI TAB BARU (JIKA DI DALAM IFRAME PREVIEW)</span>
                </div>
                <p className="text-slate-300 leading-relaxed text-[11px]">
                  Kebijakan keamanan Google Chrome memblokir pop-up pemilihan port hardware USB Serial jika halaman berjalan di dalam <code>iframe</code>. Buka halaman ini secara langsung di jendela browser utama.
                </p>
                <a
                  href={typeof window !== 'undefined' ? window.location.href : '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-tech font-bold text-xs"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Buka Aplikasi di Tab Baru ↗</span>
                </a>
              </div>

              {/* Check 3: WiFi Hotspot vs USB Serial */}
              <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-700/60 space-y-2">
                <div className="flex items-center gap-2 text-slate-200 font-bold font-tech text-sm">
                  <span className="w-5 h-5 rounded-full bg-slate-700 flex items-center justify-center text-xs">3</span>
                  <span>KENAPA WIFI MENAMPILKAN "FAILED TO FETCH"?</span>
                </div>
                <p className="text-slate-300 leading-relaxed text-[11px]">
                  Sketch firmware yang Anda upload ke ESP32 saat ini mencetak data ke USB Serial (<code>Serial.println</code>) dan tidak memiliki WebServer HTTP pada port 80. Oleh karena itu, gunakan opsi <strong>USB Serial (COM4)</strong>, bukan WiFi HTTP.
                </p>
              </div>

              {/* Hardware Summary */}
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-slate-400 flex flex-col gap-1">
                <div>• Perangkat: <strong>ESP32-D0WD-V3</strong> (MAC: <code className="text-cyan-300">f4:65:0b:57:13:bc</code>)</div>
                <div>• Target Port: <strong>COM4</strong> (Baud Rate: <strong>9600</strong>)</div>
                <div>• Hotspot SSID: <strong>AAA</strong> (Status: Station Mode ESP32)</div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowConnectHelpModal(false);
                  setIsSimulated(true);
                  serialManagerRef.current?.startSimulation(43821, '084291');
                }}
                className="px-3.5 py-2 rounded-xl bg-purple-950/60 hover:bg-purple-900/60 border border-purple-700/50 text-purple-300 text-xs font-mono-code cursor-pointer"
              >
                Coba Mode Simulasi COM4
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowConnectHelpModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white text-xs font-mono-code cursor-pointer"
                >
                  Tutup
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowConnectHelpModal(false);
                    handleConnectSerial();
                  }}
                  className="px-5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-tech font-bold text-xs shadow-md shadow-cyan-500/20 cursor-pointer"
                >
                  HUBUNGKAN COM4 SEKARANG
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
