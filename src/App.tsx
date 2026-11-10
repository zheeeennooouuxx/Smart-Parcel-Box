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
import { AlertTriangle, X } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [baudRate, setBaudRate] = useState<number>(9600);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [isSimulated, setIsSimulated] = useState<boolean>(false);
  const [alertBanner, setAlertBanner] = useState<{ message: string; type: 'error' | 'warning' | 'info' } | null>(null);
  const [newDeviceBanner, setNewDeviceBanner] = useState<boolean>(true);

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

  // Connect Handler (USB Serial vs WiFi Hotspot)
  const handleConnect = async () => {
    setAlertBanner(null);
    if (state.connectionType === 'WIFI') {
      if (!wifiManagerRef.current) return;
      await wifiManagerRef.current.connect(state.wifiConfig, isSimulated);
    } else {
      if (!serialManagerRef.current) return;
      await serialManagerRef.current.connect(baudRate);
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

      {/* Alert Banner if active */}
      {alertBanner && (
        <div className={`px-4 py-3 flex items-center justify-between text-xs font-mono-code ${
          alertBanner.type === 'error'
            ? 'bg-rose-950/80 border-b border-rose-800 text-rose-300'
            : 'bg-amber-950/80 border-b border-amber-800 text-amber-300'
        }`}>
          <div className="flex items-center gap-2 max-w-4xl mx-auto">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{alertBanner.message}</span>
          </div>
          <button
            onClick={() => setAlertBanner(null)}
            aria-label="Tutup Peringatan"
            className="p-1 hover:bg-black/30 rounded"
          >
            <X className="w-4 h-4" />
          </button>
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
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleConnect}
              className="px-3.5 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold font-tech text-xs tracking-wider transition-all shadow-md shadow-cyan-500/25 flex items-center gap-1.5 cursor-pointer"
            >
              HUBUNGKAN COM4 SEKARANG
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
    </div>
  );
}
