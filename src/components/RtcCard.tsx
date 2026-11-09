import React from 'react';
import { Clock, Calendar, AlertTriangle, ShieldCheck, Timer, Cpu } from 'lucide-react';
import { RTCStatus } from '../types/serial';

interface RtcCardProps {
  rtcStatus: RTCStatus;
  date?: string;
  time?: string;
  period?: number;
  errorMessage?: string;
}

export const RtcCard: React.FC<RtcCardProps> = ({
  rtcStatus,
  date,
  time,
  period,
  errorMessage,
}) => {
  const isOk = rtcStatus === 'OK';
  const isError = rtcStatus === 'ERROR';

  // Calculate progress of the 12-hour period window based on RTC time (HH:mm:ss)
  const calculatePeriodProgress = (): number => {
    if (!time) return 0;
    const parts = time.split(':').map(Number);
    if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
      const hours = parts[0];
      const minutes = parts[1];
      const seconds = parts[2] || 0;
      // 12-hour window: 0-12 or 12-24
      const hoursInWindow = hours % 12;
      const totalSecondsInWindow = hoursInWindow * 3600 + minutes * 60 + seconds;
      const totalSecondsIn12Hours = 12 * 3600;
      return Math.min(100, Math.max(0, (totalSecondsInWindow / totalSecondsIn12Hours) * 100));
    }
    return 0;
  };

  const progress = calculatePeriodProgress();

  return (
    <div className="rounded-2xl bg-gradient-to-br from-[#0c1326] to-[#070b16] border border-slate-800/80 p-6 flex flex-col justify-between shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-800/80">
        <div className="flex items-center gap-2.5">
          <div className={`p-2 rounded-lg ${
            isOk 
              ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' 
              : isError 
              ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
              : 'bg-slate-800 text-slate-400'
          }`}>
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white tracking-wide font-tech uppercase">
              WAKTU HARDWARE RTC DS1302
            </h3>
            <span className="text-[11px] text-slate-400">
              Basis Waktu Dinamis ESP32
            </span>
          </div>
        </div>

        {/* Status Badge */}
        <div>
          {isOk ? (
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 text-xs font-bold font-mono-code">
              <ShieldCheck className="w-3.5 h-3.5" />
              RTC OK
            </span>
          ) : isError ? (
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/15 border border-rose-500/40 text-rose-400 text-xs font-bold font-mono-code">
              <AlertTriangle className="w-3.5 h-3.5" />
              RTC ERROR
            </span>
          ) : (
            <span className="px-2.5 py-1 rounded-full bg-slate-800 text-slate-400 text-xs font-mono-code">
              MENUNGGU RTC
            </span>
          )}
        </div>
      </div>

      {/* Main Digital Clock Display */}
      <div className="my-6">
        {isOk && time ? (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-black/50 border border-cyan-900/40 text-center">
              <div className="text-4xl md:text-5xl font-mono-code font-bold tracking-widest text-cyan-300 drop-shadow-[0_0_12px_rgba(6,182,212,0.5)]">
                {time}
              </div>
              <div className="flex items-center justify-center gap-2 mt-2 text-xs font-mono-code text-slate-400">
                <Calendar className="w-3.5 h-3.5 text-cyan-400" />
                <span>{date || 'YYYY-MM-DD'}</span>
                <span className="text-slate-600">•</span>
                <span className="text-cyan-400">DS1302 Hardware Clock</span>
              </div>
            </div>

            {/* 12-Hour Period Progress Bar */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-mono-code">
                <span className="text-slate-400 flex items-center gap-1">
                  <Timer className="w-3.5 h-3.5 text-cyan-400" />
                  Siklus Interval 12 Jam
                </span>
                <span className="text-cyan-300 font-semibold">{Math.round(progress)}% Selesai</span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-900 overflow-hidden border border-slate-800">
                <div 
                  className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          </div>
        ) : isError ? (
          <div className="p-4 rounded-xl bg-rose-950/20 border border-rose-800/50 text-center space-y-2">
            <AlertTriangle className="w-8 h-8 text-rose-400 mx-auto" />
            <div className="text-sm font-bold text-rose-300 font-tech">MODUL RTC DS1302 GAGAL DIBACA</div>
            <p className="text-xs text-rose-400/80">
              {errorMessage || 'Periksa koneksi pin CLK, DAT, RST atau baterai coin cell CR2032 pada modul DS1302.'}
            </p>
          </div>
        ) : (
          <div className="p-6 rounded-xl bg-slate-900/40 border border-slate-800 text-center text-slate-500 text-xs font-mono-code flex flex-col items-center gap-2">
            <Cpu className="w-6 h-6 text-slate-600" />
            <span>Menunggu pembacaan waktu dari modul RTC DS1302...</span>
          </div>
        )}
      </div>

      {/* Footer Notice */}
      <div className="pt-3 border-t border-slate-800/80 text-[10px] text-slate-500 font-mono-code flex items-center justify-between">
        <span>Periode: {period !== undefined ? `#${period}` : 'N/A'}</span>
        <span className="text-cyan-400/80">Otentik RTC ESP32 (Bukan Jam Komputer)</span>
      </div>
    </div>
  );
};
