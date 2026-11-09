import React, { useState } from 'react';
import { 
  KeyRound, 
  Eye, 
  EyeOff, 
  Copy, 
  Check, 
  ShieldAlert, 
  ShieldCheck, 
  Clock, 
  Lock, 
  Cpu, 
  HelpCircle 
} from 'lucide-react';
import { ParcelBoxState } from '../types/serial';

interface PinCardProps {
  state: ParcelBoxState;
  onConnectClick: () => void;
}

export const PinCard: React.FC<PinCardProps> = ({ state, onConnectClick }) => {
  const [isRevealed, setIsRevealed] = useState(false);
  const [copied, setCopied] = useState(false);

  const hasPin = Boolean(state.pin && state.pin.length === 6 && state.connectionStatus === 'CONNECTED' && state.rtcStatus !== 'ERROR');
  const isRtcError = state.rtcStatus === 'ERROR';
  const isDisconnected = state.connectionStatus === 'DISCONNECTED' || state.connectionStatus === 'ERROR';
  const isConnecting = state.connectionStatus === 'CONNECTING';

  const handleCopyPin = async () => {
    if (!hasPin || !state.pin) return;
    try {
      await navigator.clipboard.writeText(state.pin);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const textarea = document.createElement('textarea');
      textarea.value = state.pin;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0c1630] via-[#0b1328] to-[#070b16] border border-cyan-500/30 p-6 md:p-8 shadow-2xl shadow-cyan-950/40">
      {/* Background cyber grid and subtle glow */}
      <div className="absolute top-0 right-0 -mt-12 -mr-12 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 -mb-12 -ml-12 w-64 h-64 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top Header Row */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-cyan-900/30">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-400">
            <KeyRound className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase font-bold tracking-widest text-cyan-400 font-mono-code">
                Kredensial Dinamis
              </span>
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-400"></span>
              <span className="text-xs text-slate-400 font-mono-code">
                HMAC-SHA256 • 12 Jam
              </span>
            </div>
            <h2 className="text-xl md:text-2xl font-bold text-white tracking-wide font-tech">
              PIN AKTIF SMART PARCEL BOX
            </h2>
          </div>
        </div>

        {/* Status Badge */}
        <div>
          {hasPin ? (
            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 text-xs font-bold font-mono-code tracking-wider">
              <ShieldCheck className="w-4 h-4" />
              <span>STATUS: ACTIVE</span>
            </div>
          ) : isRtcError ? (
            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-rose-500/15 border border-rose-500/40 text-rose-400 text-xs font-bold font-mono-code tracking-wider">
              <ShieldAlert className="w-4 h-4" />
              <span>STATUS: RTC ERROR</span>
            </div>
          ) : isConnecting ? (
            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/15 border border-amber-500/40 text-amber-400 text-xs font-bold font-mono-code tracking-wider">
              <Cpu className="w-4 h-4 animate-spin" />
              <span>STATUS: MENUNGGU DATA</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-800 border border-slate-700 text-slate-400 text-xs font-bold font-mono-code tracking-wider">
              <Lock className="w-4 h-4" />
              <span>STATUS: WAITING FOR DEVICE</span>
            </div>
          )}
        </div>
      </div>

      {/* Main Display Area */}
      <div className="my-8 flex flex-col items-center justify-center text-center">
        {hasPin ? (
          <div className="w-full max-w-lg space-y-6">
            {/* 6-Digit Display Container */}
            <div className="relative py-6 px-8 rounded-2xl bg-black/60 border-2 border-cyan-500/40 shadow-[0_0_40px_rgba(6,182,212,0.15)] flex items-center justify-center">
              <div 
                data-testid="pin-display"
                className="font-mono-code text-5xl md:text-7xl font-extrabold tracking-[0.25em] text-cyan-300 drop-shadow-[0_0_15px_rgba(6,182,212,0.8)] select-none transition-all"
              >
                {isRevealed ? (
                  state.pin
                ) : (
                  <span className="tracking-[0.3em] text-slate-500 opacity-80">
                    ••••••
                  </span>
                )}
              </div>

              {/* Discreet Lock Indicator */}
              <div className="absolute top-3 right-4 text-xs font-mono-code text-cyan-400/60 flex items-center gap-1">
                {isRevealed ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                <span>{isRevealed ? 'VISIBLE' : 'HIDDEN'}</span>
              </div>
            </div>

            {/* Action Buttons: SHOW/HIDE and COPY */}
            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                onClick={() => setIsRevealed(!isRevealed)}
                aria-label={isRevealed ? "Sembunyikan PIN (HIDE PIN)" : "Tampilkan PIN (SHOW PIN)"}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-cyan-300 border border-cyan-800/70 hover:border-cyan-500 text-sm font-semibold tracking-wide transition-all shadow-md active:scale-95"
              >
                {isRevealed ? (
                  <>
                    <EyeOff className="w-4 h-4 text-cyan-400" />
                    <span>HIDE PIN</span>
                  </>
                ) : (
                  <>
                    <Eye className="w-4 h-4 text-cyan-400" />
                    <span>SHOW PIN</span>
                  </>
                )}
              </button>

              <button
                onClick={handleCopyPin}
                aria-label="Salin PIN ke Clipboard (COPY PIN)"
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 text-sm font-bold tracking-wider transition-all shadow-lg shadow-cyan-500/25 active:scale-95 font-tech"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 text-slate-950 stroke-[3]" />
                    <span>PIN TERSALIN!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 text-slate-950" />
                    <span>COPY PIN</span>
                  </>
                )}
              </button>
            </div>
          </div>
        ) : isRtcError ? (
          /* RTC Error State */
          <div className="w-full max-w-lg p-6 rounded-2xl bg-rose-950/30 border border-rose-800/60 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto border border-rose-500/40">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-rose-300 font-tech">
                RTC DS1302 TIDAK SIAP (ERROR)
              </h3>
              <p className="text-xs text-rose-400/90 mt-1 max-w-md mx-auto">
                PIN dinamis ditangguhkan demi keamanan karena waktu RTC tidak valid atau baterai CR2032 habis. Periksa kabel VCC, GND, CLK, DAT, RST pada modul DS1302.
              </p>
            </div>
            <div className="text-xs font-mono-code text-rose-300/80 bg-rose-950/80 py-2 px-4 rounded-lg border border-rose-900/60">
              Pesan ESP32: {state.errorMessage || 'RTC NOT READY'}
            </div>
          </div>
        ) : (
          /* Disconnected / Waiting for Device State */
          <div className="w-full max-w-lg p-6 rounded-2xl bg-slate-900/60 border border-slate-800 text-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-cyan-950/40 text-cyan-400 flex items-center justify-center mx-auto border border-cyan-800/40">
              <Lock className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white font-tech">
                WAITING FOR DEVICE
              </h3>
              <p className="text-xs text-slate-400 mt-1.5 max-w-md mx-auto">
                {isConnecting
                  ? 'Port serial terbuka. Menunggu paket status JSON pertama dari ESP32...'
                  : 'ESP32 belum terhubung via USB Serial. Hubungkan kabel USB dan klik tombol CONNECT DEVICE di atas.'}
              </p>
            </div>

            {isDisconnected && (
              <button
                onClick={onConnectClick}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/50 text-xs font-bold font-tech tracking-wider transition-all"
              >
                <span>HUBUNGKAN ESP32 SEKARANG</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Bottom Metadata Cards: Periode, Waktu RTC, Algoritma */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-6 border-t border-cyan-900/30">
        <div className="p-3.5 rounded-xl bg-[#080d1c]/80 border border-slate-800/80 flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-cyan-950/80 border border-cyan-800/50 text-cyan-400">
            <KeyRound className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold text-slate-500 font-mono-code">
              PERIODE PIN AKTIF
            </div>
            <div className="text-sm md:text-base font-bold text-white font-mono-code">
              {state.period !== undefined ? `#${state.period}` : '—'}
            </div>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-[#080d1c]/80 border border-slate-800/80 flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-blue-950/80 border border-blue-800/50 text-blue-400">
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold text-slate-500 font-mono-code">
              WAKTU RTC DS1302
            </div>
            <div className="text-sm md:text-base font-bold text-cyan-300 font-mono-code">
              {state.time && state.date ? `${state.time}` : '—'}
            </div>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-[#080d1c]/80 border border-slate-800/80 flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400">
            <HelpCircle className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold text-slate-500 font-mono-code">
              INTERVAL VALIDASI
            </div>
            <div className="text-xs md:text-sm font-semibold text-slate-300 font-mono-code">
              12 Jam (HMAC-SHA256)
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
