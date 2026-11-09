import React from 'react';
import { DoorClosed, DoorOpen, ShieldCheck, AlertCircle, Package } from 'lucide-react';
import { DoorStatus } from '../types/serial';

interface DoorCardProps {
  doorStatus: DoorStatus;
  lastUpdated?: number;
}

export const DoorCard: React.FC<DoorCardProps> = ({ doorStatus, lastUpdated }) => {
  const isOpen = doorStatus === 'OPEN';
  const isClosed = doorStatus === 'CLOSED';
  const isUnknown = doorStatus === 'UNKNOWN';

  return (
    <div className="rounded-2xl bg-gradient-to-br from-[#0c1326] to-[#070b16] border border-slate-800/80 p-6 flex flex-col justify-between shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-800/80">
        <div className="flex items-center gap-2.5">
          <div className={`p-2 rounded-lg ${
            isOpen 
              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' 
              : isClosed 
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
              : 'bg-slate-800 text-slate-400'
          }`}>
            <Package className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white tracking-wide font-tech uppercase">
              STATUS PINTU (REED SWITCH)
            </h3>
            <span className="text-[11px] text-slate-400">
              Sensor Magnetik GPIO ESP32
            </span>
          </div>
        </div>

        {/* Badge */}
        <div>
          {isOpen ? (
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/40 text-amber-300 text-xs font-bold font-mono-code animate-pulse">
              <DoorOpen className="w-3.5 h-3.5" />
              DOOR OPEN
            </span>
          ) : isClosed ? (
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 text-xs font-bold font-mono-code">
              <DoorClosed className="w-3.5 h-3.5" />
              DOOR CLOSED
            </span>
          ) : (
            <span className="px-2.5 py-1 rounded-full bg-slate-800 text-slate-400 text-xs font-mono-code">
              MENUNGGU DATA
            </span>
          )}
        </div>
      </div>

      {/* Visual Parcel Box Graphic */}
      <div className="my-6 flex flex-col items-center justify-center">
        <div className="relative w-40 h-40 flex items-center justify-center">
          {/* Outer Locker Box graphic */}
          <div className={`w-36 h-36 rounded-2xl border-2 transition-all duration-500 flex flex-col items-center justify-between p-3 ${
            isOpen 
              ? 'bg-amber-950/20 border-amber-500/60 shadow-[0_0_25px_rgba(245,158,11,0.2)]'
              : isClosed
              ? 'bg-emerald-950/20 border-emerald-500/60 shadow-[0_0_25px_rgba(16,185,129,0.15)]'
              : 'bg-slate-900/50 border-slate-700/60'
          }`}>
            {/* Box Roof & Sensor LED */}
            <div className="w-full flex items-center justify-between px-1">
              <span className="text-[9px] font-mono-code text-slate-400">SMART LOCKER</span>
              <div className="flex items-center gap-1">
                <span className="text-[8px] font-mono-code text-slate-500">MAGNET</span>
                <span className={`h-2 w-2 rounded-full ${
                  isOpen ? 'bg-amber-400 animate-ping' : isClosed ? 'bg-emerald-400' : 'bg-slate-600'
                }`}></span>
              </div>
            </div>

            {/* Door Center Graphic */}
            <div className="relative flex flex-col items-center">
              {isOpen ? (
                <div className="relative">
                  <div className="transform -rotate-12 transition-transform duration-300">
                    <DoorOpen className="w-16 h-16 text-amber-400 drop-shadow-[0_0_10px_rgba(245,158,11,0.6)]" />
                  </div>
                  <div className="absolute -top-1 -right-2 px-1.5 py-0.5 rounded bg-amber-500 text-slate-950 font-mono-code font-bold text-[9px]">
                    BUKA
                  </div>
                </div>
              ) : isClosed ? (
                <div className="relative">
                  <DoorClosed className="w-16 h-16 text-emerald-400 drop-shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                  <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                    <ShieldCheck className="w-5 h-5 text-emerald-300" />
                  </div>
                </div>
              ) : (
                <DoorClosed className="w-16 h-16 text-slate-600" />
              )}
            </div>

            {/* Bottom Handle & Status Line */}
            <div className="w-full flex items-center justify-between px-1">
              <div className="h-1 w-8 rounded-full bg-slate-700"></div>
              <span className={`text-[10px] font-mono-code font-semibold ${
                isOpen ? 'text-amber-300' : isClosed ? 'text-emerald-300' : 'text-slate-500'
              }`}>
                {isOpen ? 'TERBUKA' : isClosed ? 'TERKUNCI AMAN' : 'STANDBY'}
              </span>
            </div>
          </div>
        </div>

        {/* Status text label */}
        <div className="text-center mt-2">
          <p className="text-xs text-slate-400">
            {isOpen 
              ? 'Kontak reed switch terputus. Pintu paket sedang dibuka.'
              : isClosed
              ? 'Kontak magnetik tertutup rapat. Paket tersimpan dengan aman.'
              : 'Menunggu pembacaan status pin reed switch dari ESP32.'}
          </p>
        </div>
      </div>

      {/* Footer details */}
      <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] font-mono-code text-slate-500">
        <span>Kontrol Servo: Arduino Uno</span>
        <span>{lastUpdated ? `Pembaruan: ${new Date(lastUpdated).toLocaleTimeString()}` : 'Belum ada data'}</span>
      </div>
    </div>
  );
};
