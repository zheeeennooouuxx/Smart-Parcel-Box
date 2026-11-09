import React from 'react';
import { 
  Usb, 
  ShieldCheck, 
  AlertTriangle, 
  Power, 
  RotateCw, 
  Cpu,
  Radio,
  SlidersHorizontal
} from 'lucide-react';
import { SerialConnectionStatus, RTCStatus } from '../types/serial';

interface HeaderProps {
  connectionStatus: SerialConnectionStatus;
  rtcStatus: RTCStatus;
  portInfo?: string;
  baudRate: number;
  isSimulated: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
  onToggleSimulator: () => void;
  onOpenSettings: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  connectionStatus,
  rtcStatus,
  portInfo,
  baudRate,
  isSimulated,
  onConnect,
  onDisconnect,
  onToggleSimulator,
  onOpenSettings,
}) => {
  const getStatusBadge = () => {
    switch (connectionStatus) {
      case 'CONNECTED':
        return (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-medium">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="tracking-wide">TERHUBUNG (CONNECTED)</span>
          </div>
        );
      case 'CONNECTING':
        return (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-medium">
            <RotateCw className="w-3.5 h-3.5 animate-spin" />
            <span className="tracking-wide">MENUNGGU DATA ESP32</span>
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
    <header className="sticky top-0 z-30 bg-[#0b1329]/90 backdrop-blur-md border-b border-cyan-900/30 px-4 lg:px-8 py-3.5 flex flex-wrap items-center justify-between gap-4">
      {/* Brand & Title */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20 border border-cyan-400/30">
          <ShieldCheck className="w-6 h-6 text-white" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg md:text-xl font-bold tracking-wider text-white font-tech">
              SMART PARCEL BOX
            </h1>
            <span className="text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded bg-cyan-950/80 text-cyan-400 border border-cyan-800/60 font-mono-code">
              ESP32 USB
            </span>
          </div>
          <p className="text-xs text-slate-400 hidden sm:block">
            Dashboard Pemantauan & Akses PIN Dinamis Enam Digit
          </p>
        </div>
      </div>

      {/* Center status indicators */}
      <div className="flex items-center gap-3">
        {getStatusBadge()}

        {isSimulated && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-purple-950/60 border border-purple-700/50 text-purple-300 text-xs font-mono-code">
            <Cpu className="w-3.5 h-3.5 text-purple-400" />
            <span>MODE SIMULATOR</span>
          </div>
        )}

        {portInfo && connectionStatus === 'CONNECTED' && (
          <div className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-900/80 border border-slate-800 text-slate-300 text-xs font-mono-code">
            <Radio className="w-3 h-3 text-cyan-400" />
            <span className="truncate max-w-[160px]">{portInfo}</span>
            <span className="text-cyan-400 font-semibold">@{baudRate}</span>
          </div>
        )}
      </div>

      {/* Action Controls */}
      <div className="flex items-center gap-2">
        {connectionStatus === 'CONNECTED' || connectionStatus === 'CONNECTING' ? (
          <button
            onClick={onDisconnect}
            aria-label="Disconnect ESP32 serial port"
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/60 text-rose-300 text-xs font-semibold tracking-wide transition-all shadow-sm active:scale-95"
          >
            <Power className="w-4 h-4 text-rose-400" />
            <span>DISCONNECT</span>
          </button>
        ) : (
          <button
            onClick={onConnect}
            aria-label="Connect to ESP32 via USB Serial"
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 text-xs font-bold tracking-wider shadow-lg shadow-cyan-500/20 transition-all active:scale-95 font-tech"
          >
            <Usb className="w-4 h-4 text-slate-950" />
            <span>CONNECT DEVICE</span>
          </button>
        )}

        <button
          onClick={onToggleSimulator}
          aria-label={isSimulated ? "Matikan Simulator" : "Simulasi ESP32"}
          title={isSimulated ? "Matikan Simulator" : "Gunakan Virtual ESP32 Simulator jika tidak ada kabel USB"}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium transition-colors ${
            isSimulated
              ? 'bg-purple-900/40 border-purple-500 text-purple-200'
              : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-cyan-300 hover:border-cyan-800/60'
          }`}
        >
          <Cpu className="w-4 h-4" />
          <span className="hidden md:inline">{isSimulated ? 'Stop Sim' : 'Simulasi'}</span>
        </button>

        <button
          onClick={onOpenSettings}
          aria-label="Buka Pengaturan"
          title="Pengaturan Serial & Perangkat"
          className="p-2 rounded-lg bg-slate-900/60 border border-slate-800 text-slate-400 hover:text-cyan-300 hover:border-cyan-800/60 transition-colors"
        >
          <SlidersHorizontal className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
