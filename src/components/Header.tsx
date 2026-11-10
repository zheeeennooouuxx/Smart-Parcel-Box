import React, { useState } from 'react';
import { 
  Usb, 
  Wifi, 
  WifiOff, 
  ShieldCheck, 
  AlertTriangle, 
  Power, 
  RotateCw, 
  Cpu,
  Radio,
  SlidersHorizontal,
  Terminal,
  Signal,
  CheckCircle2,
  ExternalLink,
  ChevronDown
} from 'lucide-react';
import { SerialConnectionStatus, RTCStatus, ConnectionType, WifiConfig } from '../types/serial';

interface HeaderProps {
  connectionStatus: SerialConnectionStatus;
  connectionType: ConnectionType;
  onConnectionTypeChange: (type: ConnectionType) => void;
  rtcStatus: RTCStatus;
  portInfo?: string;
  baudRate: number;
  wifiConfig: WifiConfig;
  onWifiConfigChange: (config: Partial<WifiConfig>) => void;
  isSimulated: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
  onToggleSimulator: () => void;
  onOpenSettings: () => void;
  onOpenSerialMonitor?: () => void;
  onTestPingWifi?: () => Promise<{ success: boolean; latencyMs?: number; error?: string; details?: string }>;
}

export const Header: React.FC<HeaderProps> = ({
  connectionStatus,
  connectionType,
  onConnectionTypeChange,
  rtcStatus,
  portInfo,
  baudRate,
  wifiConfig,
  onWifiConfigChange,
  isSimulated,
  onConnect,
  onDisconnect,
  onToggleSimulator,
  onOpenSettings,
  onOpenSerialMonitor,
  onTestPingWifi,
}) => {
  const [showWifiModal, setShowWifiModal] = useState(false);
  const [pingResult, setPingResult] = useState<{ success: boolean; latencyMs?: number; msg: string } | null>(null);
  const [isPinging, setIsPinging] = useState(false);

  const isConnected = connectionStatus === 'CONNECTED';
  const isConnecting = connectionStatus === 'CONNECTING';

  const handlePing = async () => {
    if (!onTestPingWifi) return;
    setIsPinging(true);
    setPingResult(null);
    try {
      const res = await onTestPingWifi();
      setPingResult({
        success: res.success,
        latencyMs: res.latencyMs,
        msg: res.success ? (res.details || 'Ping berhasil') : (res.error || 'Gagal terhubung'),
      });
    } catch (err: unknown) {
      const error = err as Error;
      setPingResult({ success: false, msg: error.message });
    } finally {
      setIsPinging(false);
    }
  };

  const getStatusBadge = () => {
    switch (connectionStatus) {
      case 'CONNECTED':
        return (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-medium">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="tracking-wide">
              {connectionType === 'WIFI' ? 'TERHUBUNG (HOTSPOT ESP32)' : 'TERHUBUNG (USB SERIAL)'}
            </span>
          </div>
        );
      case 'CONNECTING':
        return (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-medium">
            <RotateCw className="w-3.5 h-3.5 animate-spin" />
            <span className="tracking-wide">
              {connectionType === 'WIFI' ? 'MENYAMBUNGKAN HOTSPOT...' : 'MENUNGGU DATA ESP32...'}
            </span>
          </div>
        );
      case 'ERROR':
        return (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-medium">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span className="tracking-wide">KESALAHAN KONEKSI</span>
          </div>
        );
      case 'DISCONNECTED':
      default:
        return (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800 border border-slate-700 text-slate-400 text-xs font-medium">
            <span className="h-2 w-2 rounded-full bg-slate-500"></span>
            <span className="tracking-wide">TERPUTUS (OFFLINE)</span>
          </div>
        );
    }
  };

  return (
    <>
      <header className="sticky top-0 z-30 bg-[#0b1329]/95 backdrop-blur-md border-b border-cyan-900/30 px-4 lg:px-8 py-3 flex flex-wrap items-center justify-between gap-3 shadow-md">
        {/* Brand & Title */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20 border border-cyan-400/30 shrink-0">
            <ShieldCheck className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg md:text-xl font-bold tracking-wider text-white font-tech">
                SMART PARCEL BOX
              </h1>
              <span className="text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded bg-cyan-950/80 text-cyan-400 border border-cyan-800/60 font-mono-code">
                {connectionType === 'WIFI' ? 'WIFI HOTSPOT' : 'USB SERIAL'}
              </span>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block">
              Dashboard Pemantauan & Akses PIN Dinamis Enam Digit
            </p>
          </div>
        </div>

        {/* Center Connection Selector & Status */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Method Switcher: USB Serial vs WiFi Hotspot */}
          <div className="flex items-center p-0.5 rounded-xl bg-black/60 border border-slate-800 text-xs font-mono-code">
            <button
              onClick={() => {
                if (connectionType !== 'SERIAL') {
                  if (isConnected) onDisconnect();
                  onConnectionTypeChange('SERIAL');
                }
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-all ${
                connectionType === 'SERIAL'
                  ? 'bg-cyan-500/25 text-cyan-300 border border-cyan-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Usb className="w-3.5 h-3.5" />
              <span>USB Serial</span>
            </button>

            <button
              onClick={() => {
                if (connectionType !== 'WIFI') {
                  if (isConnected) onDisconnect();
                  onConnectionTypeChange('WIFI');
                }
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-all ${
                connectionType === 'WIFI'
                  ? 'bg-blue-500/25 text-blue-300 border border-blue-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Wifi className="w-3.5 h-3.5" />
              <span>WiFi Hotspot</span>
              {wifiConfig.ip && (
                <span className="text-[10px] font-mono-code px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 hidden sm:inline">
                  {wifiConfig.ip}
                </span>
              )}
            </button>
          </div>

          {getStatusBadge()}

          {/* Quick-switch to WiFi button when IP was auto-detected from Serial */}
          {connectionType === 'SERIAL' && wifiConfig.ip && (
            <button
              onClick={() => setShowWifiModal(true)}
              title={`IP ESP32 Tercatat: ${wifiConfig.ip}. Klik untuk membuka menu WiFi Hotspot.`}
              className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-700/60 text-cyan-300 text-xs font-mono-code transition-all shadow-sm cursor-pointer"
            >
              <Signal className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
              <span>IP ESP32: <strong>{wifiConfig.ip}</strong></span>
              <span className="text-[10px] text-cyan-400/80 underline ml-1">Menu WiFi ➜</span>
            </button>
          )}

          {isSimulated && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-purple-950/60 border border-purple-700/50 text-purple-300 text-xs font-mono-code">
              <Cpu className="w-3.5 h-3.5 text-purple-400" />
              <span>SIMULATOR</span>
            </div>
          )}

          {/* Connection Detail Badge */}
          {connectionType === 'WIFI' ? (
            <button
              onClick={() => setShowWifiModal(true)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-900/80 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs font-mono-code transition-colors cursor-pointer"
            >
              <Signal className="w-3 h-3 text-cyan-400" />
              <span className="truncate max-w-[140px] font-bold text-cyan-300">
                {wifiConfig.ssid}
              </span>
              <span className="text-slate-500">({wifiConfig.ip})</span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>
          ) : (
            portInfo && isConnected && (
              <div className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-900/80 border border-slate-800 text-slate-300 text-xs font-mono-code">
                <Radio className="w-3 h-3 text-cyan-400" />
                <span className="truncate max-w-[150px]">{portInfo}</span>
                <span className="text-cyan-400 font-semibold">@{baudRate}</span>
              </div>
            )
          )}
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {isConnected || isConnecting ? (
            <button
              onClick={onDisconnect}
              aria-label="Putus koneksi perangkat"
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/60 text-rose-300 text-xs font-semibold tracking-wide transition-all shadow-sm active:scale-95"
            >
              <Power className="w-4 h-4 text-rose-400" />
              <span>DISCONNECT</span>
            </button>
          ) : (
            <button
              onClick={onConnect}
              aria-label={connectionType === 'WIFI' ? "Hubungkan ke ESP32 via WiFi Hotspot" : "Hubungkan ke ESP32 via USB Serial"}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 text-xs font-bold tracking-wider shadow-lg shadow-cyan-500/20 transition-all active:scale-95 font-tech"
            >
              {connectionType === 'WIFI' ? (
                <>
                  <Wifi className="w-4 h-4 text-slate-950" />
                  <span>CONNECT WIFI</span>
                </>
              ) : (
                <>
                  <Usb className="w-4 h-4 text-slate-950" />
                  <span>CONNECT USB</span>
                </>
              )}
            </button>
          )}

          <button
            onClick={onToggleSimulator}
            aria-label={isSimulated ? "Matikan Simulator" : "Simulasi ESP32"}
            title={isSimulated ? "Matikan Simulator" : "Gunakan Virtual ESP32 Simulator"}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-medium transition-colors ${
              isSimulated
                ? 'bg-purple-900/40 border-purple-500 text-purple-200'
                : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-cyan-300 hover:border-cyan-800/60'
            }`}
          >
            <Cpu className="w-4 h-4" />
            <span className="hidden md:inline">{isSimulated ? 'Stop Sim' : 'Simulasi'}</span>
          </button>

          {onOpenSerialMonitor && (
            <button
              onClick={onOpenSerialMonitor}
              aria-label="Buka Serial Monitor & Terminal Jaringan"
              title="Buka Terminal Serial/Network Monitor"
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-cyan-950/40 hover:bg-cyan-900/60 border border-cyan-800/60 text-cyan-300 text-xs font-tech font-bold transition-colors shadow-sm"
            >
              <Terminal className="w-4 h-4 text-cyan-400" />
              <span className="hidden sm:inline">Terminal</span>
            </button>
          )}

          <button
            onClick={onOpenSettings}
            aria-label="Buka Pengaturan"
            title="Pengaturan Serial, WiFi & Perangkat"
            className="p-2 rounded-xl bg-slate-900/60 border border-slate-800 text-slate-400 hover:text-cyan-300 hover:border-cyan-800/60 transition-colors"
          >
            <SlidersHorizontal className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* WiFi Hotspot Quick Configuration Modal */}
      {showWifiModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0b1329] border border-cyan-500/40 rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl relative animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30">
                  <Wifi className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white font-tech">
                    PENGATURAN WIFI HOTSPOT ESP32
                  </h3>
                  <p className="text-xs text-slate-400 font-mono-code">
                    Koneksi nirkabel SoftAP / Access Point
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowWifiModal(false)}
                className="text-slate-500 hover:text-white p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs font-mono-code">
              {/* Highlight card if IP was auto-detected from Serial */}
              {wifiConfig.ip && (
                <div className="p-3.5 rounded-2xl bg-gradient-to-r from-blue-950/80 via-[#0a1b38] to-cyan-950/80 border border-cyan-500/40 shadow-inner space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-cyan-300 font-bold font-tech flex items-center gap-1.5 text-xs">
                      <CheckCircle2 className="w-4 h-4 text-cyan-400" />
                      ALAMAT IP TERSINKRON DARI SERIAL MONITOR
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                      OTOMATIS
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-300">
                    <div>• Alamat IP: <strong className="text-cyan-200">{wifiConfig.ip}</strong></div>
                    <div>• SSID: <strong className="text-white">{wifiConfig.ssid || 'AAA'}</strong></div>
                    <div>• Gateway: <strong>{wifiConfig.gateway || '—'}</strong></div>
                    <div>• Subnet: <strong>{wifiConfig.subnet || '255.255.255.0'}</strong></div>
                  </div>
                </div>
              )}

              <div>
                <label className="text-slate-300 font-semibold block mb-1">
                  Nama Hotspot / SSID ESP32:
                </label>
                <input
                  type="text"
                  value={wifiConfig.ssid}
                  onChange={(e) => onWifiConfigChange({ ssid: e.target.value })}
                  placeholder="AAA"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-cyan-300 outline-none focus:border-cyan-500"
                />
                <span className="text-[11px] text-slate-500 mt-1 block">
                  Password Hotspot ESP32: <code>123456789</code> (Hotspot: "AAA")
                </span>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="text-slate-300 font-semibold block mb-1">
                    IP Address ESP32:
                  </label>
                  <input
                    type="text"
                    value={wifiConfig.ip}
                    onChange={(e) => onWifiConfigChange({ ip: e.target.value })}
                    placeholder="10.86.29.138"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-cyan-300 outline-none focus:border-cyan-500 font-bold"
                  />
                </div>
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">
                    Port:
                  </label>
                  <input
                    type="number"
                    value={wifiConfig.port}
                    onChange={(e) => onWifiConfigChange({ port: Number(e.target.value) })}
                    placeholder="80"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-cyan-300 outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">
                    Gateway:
                  </label>
                  <input
                    type="text"
                    value={wifiConfig.gateway || ''}
                    onChange={(e) => onWifiConfigChange({ gateway: e.target.value })}
                    placeholder="10.86.29.155"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-slate-300 outline-none focus:border-cyan-500 text-xs"
                  />
                </div>
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">
                    Subnet Mask:
                  </label>
                  <input
                    type="text"
                    value={wifiConfig.subnet || ''}
                    onChange={(e) => onWifiConfigChange({ subnet: e.target.value })}
                    placeholder="255.255.255.0"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-slate-300 outline-none focus:border-cyan-500 text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">
                  Protokol Komunikasi Hotspot:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => onWifiConfigChange({ protocol: 'HTTP_POLL' })}
                    className={`py-2 px-3 rounded-xl border text-center transition-all ${
                      wifiConfig.protocol === 'HTTP_POLL'
                        ? 'bg-cyan-500/25 border-cyan-500 text-cyan-300 font-bold'
                        : 'bg-slate-900 border-slate-800 text-slate-400'
                    }`}
                  >
                    HTTP REST (2s Poll)
                  </button>
                  <button
                    type="button"
                    onClick={() => onWifiConfigChange({ protocol: 'WEBSOCKET' })}
                    className={`py-2 px-3 rounded-xl border text-center transition-all ${
                      wifiConfig.protocol === 'WEBSOCKET'
                        ? 'bg-cyan-500/25 border-cyan-500 text-cyan-300 font-bold'
                        : 'bg-slate-900 border-slate-800 text-slate-400'
                    }`}
                  >
                    WebSocket (/ws)
                  </button>
                </div>
              </div>

              {/* Ping diagnostic area */}
              {pingResult && (
                <div className={`p-3 rounded-xl border ${
                  pingResult.success
                    ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-300'
                    : 'bg-rose-950/40 border-rose-500/50 text-rose-300'
                }`}>
                  <div className="flex items-center gap-2 font-bold font-tech">
                    {pingResult.success ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                    <span>{pingResult.success ? `PING SUKSES (${pingResult.latencyMs}ms)` : 'PING GAGAL'}</span>
                  </div>
                  <p className="text-[11px] mt-1 leading-relaxed opacity-90">{pingResult.msg}</p>
                </div>
              )}
            </div>

            <div className="pt-2 border-t border-slate-800 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={handlePing}
                disabled={isPinging}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-cyan-300 text-xs font-mono-code font-bold transition-colors"
              >
                <Signal className={`w-3.5 h-3.5 ${isPinging ? 'animate-pulse' : ''}`} />
                <span>{isPinging ? 'Menguji Ping...' : 'Uji Ping Hotspot'}</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowWifiModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-900 text-slate-400 hover:text-white text-xs font-mono-code"
                >
                  Tutup
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowWifiModal(false);
                    onConnectionTypeChange('WIFI');
                    onConnect();
                  }}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 text-xs font-tech font-bold shadow-md shadow-cyan-500/20"
                >
                  SIMPAN & SAMBUNGKAN
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
