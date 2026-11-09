import React, { useState } from 'react';
import { 
  KeyRound, 
  Copy, 
  Check, 
  Eye, 
  EyeOff, 
  ShieldCheck, 
  ShieldAlert, 
  Lock, 
  Cpu, 
  Clock, 
  Share2,
  Info,
  CheckCircle2
} from 'lucide-react';
import { ParcelBoxState } from '../types/serial';

interface PinAccessViewProps {
  state: ParcelBoxState;
  onConnectClick: () => void;
}

export const PinAccessView: React.FC<PinAccessViewProps> = ({ state, onConnectClick }) => {
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);

  const isConnected = state.connectionStatus === 'CONNECTED';
  const hasPin = Boolean(state.pin && state.pin.length === 6 && isConnected && state.rtcStatus !== 'ERROR');
  const isRtcError = state.rtcStatus === 'ERROR';

  const handleCopy = async () => {
    if (!hasPin || !state.pin) return;
    try {
      await navigator.clipboard.writeText(state.pin);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
      const el = document.createElement('textarea');
      el.value = state.pin;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Title & Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-wide font-tech flex items-center gap-2.5">
            <KeyRound className="w-6 h-6 text-cyan-400" />
            AKSES PIN DINAMIS ENAM DIGIT
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Gunakan PIN berikut pada keypad 4x4 Smart Parcel Box atau bagikan kepada kurir pengiriman.
          </p>
        </div>

        {hasPin && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 text-xs font-mono-code font-bold">
            <ShieldCheck className="w-4 h-4" />
            <span>PIN TERVERIFIKASI & AKTIF</span>
          </div>
        )}
      </div>

      {/* Main Focus Card */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-b from-[#0c1630] via-[#091024] to-[#050814] border-2 border-cyan-500/40 p-8 md:p-12 shadow-[0_0_50px_rgba(6,182,212,0.15)] text-center">
        <div className="absolute top-0 right-1/2 transform translate-x-1/2 w-96 h-28 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

        {hasPin ? (
          <div className="space-y-8">
            <div className="space-y-2">
              <span className="text-xs uppercase font-mono-code font-bold tracking-widest text-cyan-400">
                KODE AKSES SIKLUS #{state.period}
              </span>
              <div className="text-xs text-slate-400 font-mono-code">
                Waktu RTC: {state.time} • Valid hingga periode berikutnya berganti
              </div>
            </div>

            {/* Giant 6-digit PIN Box */}
            <div className="relative mx-auto max-w-md py-8 px-6 rounded-2xl bg-black/80 border-2 border-cyan-400/50 shadow-inner flex items-center justify-center">
              <div 
                data-testid="pin-large-display"
                className="font-mono-code text-6xl md:text-8xl font-black tracking-[0.25em] text-cyan-300 drop-shadow-[0_0_20px_rgba(6,182,212,0.8)] select-all"
              >
                {revealed ? (
                  state.pin
                ) : (
                  <span className="tracking-[0.28em] text-slate-600">
                    ••••••
                  </span>
                )}
              </div>
            </div>

            {/* Controls */}
            <div className="flex flex-wrap items-center justify-center gap-4">
              <button
                onClick={() => setRevealed(!revealed)}
                aria-label={revealed ? "Sembunyikan PIN" : "Perlihatkan PIN"}
                className="flex items-center gap-2.5 px-6 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-cyan-300 border border-cyan-700/60 hover:border-cyan-400 text-sm font-semibold tracking-wide transition-all shadow-md active:scale-95"
              >
                {revealed ? (
                  <>
                    <EyeOff className="w-5 h-5 text-cyan-400" />
                    <span>SEMBUNYIKAN PIN</span>
                  </>
                ) : (
                  <>
                    <Eye className="w-5 h-5 text-cyan-400" />
                    <span>LIHAT PIN</span>
                  </>
                )}
              </button>

              <button
                onClick={handleCopy}
                aria-label="Salin Kode PIN ke Clipboard"
                className="flex items-center gap-2.5 px-8 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 text-sm font-bold tracking-wider transition-all shadow-lg shadow-cyan-500/30 active:scale-95 font-tech"
              >
                {copied ? (
                  <>
                    <Check className="w-5 h-5 text-slate-950 stroke-[3]" />
                    <span>PIN TERSALIN!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-5 h-5 text-slate-950" />
                    <span>SALIN PIN</span>
                  </>
                )}
              </button>
            </div>
          </div>
        ) : isRtcError ? (
          <div className="py-8 space-y-4 max-w-lg mx-auto">
            <div className="w-16 h-16 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto border border-rose-500/40">
              <ShieldAlert className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-rose-300 font-tech">
              MODUL RTC DS1302 ERROR
            </h3>
            <p className="text-sm text-slate-400">
              Sistem tidak dapat menampilkan PIN karena basis waktu RTC pada ESP32 mengalami gangguan. Periksa fisik kabel dan baterai cadangan modul RTC.
            </p>
          </div>
        ) : (
          <div className="py-8 space-y-4 max-w-lg mx-auto">
            <div className="w-16 h-16 rounded-full bg-slate-800 text-slate-400 flex items-center justify-center mx-auto border border-slate-700">
              <Lock className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-white font-tech">
              WAITING FOR DEVICE (BELUM TERKONEKSI)
            </h3>
            <p className="text-sm text-slate-400">
              Untuk melihat PIN enam digit yang sah, hubungkan komputer Anda ke perangkat ESP32 via kabel data USB Serial.
            </p>
            <button
              onClick={onConnectClick}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 text-sm font-bold font-tech tracking-wider transition-all"
            >
              <span>HUBUNGKAN ESP32 VIA USB</span>
            </button>
          </div>
        )}
      </div>

      {/* Security & Instructions Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Keypad Input Guide */}
        <div className="p-6 rounded-2xl bg-[#0c1326] border border-slate-800/80 space-y-3">
          <div className="flex items-center gap-2 text-cyan-400 font-tech font-bold text-sm">
            <Info className="w-4 h-4" />
            PANDUAN INPUT PADA KEYPAD ARDUINO
          </div>
          <ul className="text-xs text-slate-400 space-y-2 font-mono-code">
            <li className="flex items-start gap-2">
              <span className="text-cyan-400 font-bold">1.</span>
              <span>Ketikkan 6 digit angka PIN pada keypad 4x4 fisik.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-cyan-400 font-bold">2.</span>
              <span>Tekan tombol <strong>#</strong> untuk konfirmasi / Enter.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-cyan-400 font-bold">3.</span>
              <span>Jika valid, buzzer akan berbunyi (BEEP_GRANTED) dan servo membuka kunci box.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-rose-400 font-bold">4.</span>
              <span>Jika salah, LCD menampilkan PIN SALAH dan buzzer berbunyi (BEEP_DENIED).</span>
            </li>
          </ul>
        </div>

        {/* Security Policy */}
        <div className="p-6 rounded-2xl bg-[#0c1326] border border-slate-800/80 space-y-3">
          <div className="flex items-center gap-2 text-emerald-400 font-tech font-bold text-sm">
            <CheckCircle2 className="w-4 h-4" />
            KEAMANAN & KRIPTOGRAFI PIN
          </div>
          <ul className="text-xs text-slate-400 space-y-2 font-mono-code">
            <li className="flex items-start gap-2">
              <span className="text-emerald-400">•</span>
              <span><strong>HMAC-SHA256:</strong> Dihasilkan hardware ESP32 dengan secret key internal.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-emerald-400">•</span>
              <span><strong>Siklus 12 Jam:</strong> PIN otomatis berubah tiap periode step 12 jam.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-emerald-400">•</span>
              <span><strong>Zero-Storage:</strong> Browser tidak menyimpan PIN secara permanen di database.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-emerald-400">•</span>
              <span><strong>Sinkronisasi Uno:</strong> Arduino Uno memverifikasi PIN melalui UART2.</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};
