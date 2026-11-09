import React from 'react';
import { 
  Settings, 
  Sliders, 
  Volume2, 
  VolumeX, 
  CheckCircle2, 
  AlertCircle, 
  Cpu, 
  DoorOpen, 
  DoorClosed, 
  Clock, 
  KeyRound, 
  ShieldCheck, 
  Globe 
} from 'lucide-react';
import { WebSerialManager } from '../services/webSerialManager';

interface SettingsViewProps {
  baudRate: number;
  onBaudRateChange: (rate: number) => void;
  isSimulated: boolean;
  onToggleSimulator: () => void;
  onSimulateDoorToggle: (state: 'OPEN' | 'CLOSED') => void;
  onSimulateRtcError: () => void;
  onSimulateNewPeriod: () => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  baudRate,
  onBaudRateChange,
  isSimulated,
  onToggleSimulator,
  onSimulateDoorToggle,
  onSimulateRtcError,
  onSimulateNewPeriod,
  soundEnabled,
  onToggleSound,
}) => {
  const isWebSerialSupported = WebSerialManager.isSupported();
  const baudRates = [9600, 19200, 38400, 57600, 115200];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-400">
          <Settings className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-white font-tech">
            PENGATURAN SERIAL & PERANGKAT
          </h2>
          <p className="text-xs text-slate-400">
            Konfigurasi koneksi port serial, kompatibilitas browser, dan simulator perangkat keras.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Serial Configuration Card */}
        <div className="p-6 rounded-2xl bg-[#0c1326] border border-slate-800/80 space-y-5">
          <div className="flex items-center gap-2 text-cyan-400 font-tech font-bold text-sm">
            <Sliders className="w-4 h-4" />
            KONFIGURASI PORT SERIAL
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-300 font-mono-code block">
              Baud Rate Serial USB (Default: 9600)
            </label>
            <div className="grid grid-cols-3 gap-2">
              {baudRates.map((rate) => (
                <button
                  key={rate}
                  onClick={() => onBaudRateChange(rate)}
                  className={`py-2 px-3 rounded-xl text-xs font-mono-code font-bold transition-all ${
                    baudRate === rate
                      ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/30'
                      : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  {rate} {rate === 9600 && '(Def)'}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-slate-500">
              Pastikan baud rate ini sama dengan <code>Serial.begin(...)</code> pada sketch ESP32.
            </p>
          </div>

          {/* Sound alert */}
          <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-slate-200">Notifikasi Suara</div>
              <div className="text-[11px] text-slate-500">Bunyi chime saat pintu terbuka/tertutup</div>
            </div>
            <button
              onClick={onToggleSound}
              className={`p-2.5 rounded-xl border transition-colors ${
                soundEnabled
                  ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40'
                  : 'bg-slate-900 text-slate-500 border-slate-800'
              }`}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Browser Compatibility Check Card */}
        <div className="p-6 rounded-2xl bg-[#0c1326] border border-slate-800/80 space-y-4">
          <div className="flex items-center gap-2 text-cyan-400 font-tech font-bold text-sm">
            <Globe className="w-4 h-4" />
            KOMPATIBILITAS WEB SERIAL API
          </div>

          <div className={`p-4 rounded-xl border flex items-start gap-3 ${
            isWebSerialSupported
              ? 'bg-emerald-950/20 border-emerald-500/40 text-emerald-300'
              : 'bg-rose-950/20 border-rose-500/40 text-rose-300'
          }`}>
            {isWebSerialSupported ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            )}
            <div className="text-xs space-y-1">
              <div className="font-bold font-tech">
                {isWebSerialSupported
                  ? 'Browser Mendukung Web Serial API'
                  : 'Web Serial API Tidak Terdeteksi'}
              </div>
              <p className="text-slate-400 text-[11px] leading-relaxed">
                {isWebSerialSupported
                  ? 'Browser berbasis Chromium Anda (Google Chrome / MS Edge) dapat mengakses ESP32 langsung melalui kabel USB.'
                  : 'Gunakan Google Chrome atau Microsoft Edge untuk mengakses port USB perangkat keras. Di lingkungan sandbox/preview ini, Anda juga dapat mengaktifkan simulator ESP32 di bawah.'}
              </p>
            </div>
          </div>

          <div className="text-[11px] text-slate-400 font-mono-code space-y-1.5 pt-2">
            <div>• Browser yang Didukung: <strong>Chrome 89+, Edge 89+, Opera 75+</strong></div>
            <div>• Keamanan: Hanya berjalan pada konteks aman (HTTPS atau localhost).</div>
          </div>
        </div>
      </div>

      {/* Virtual ESP32 Hardware Simulator Control Panel */}
      <div className="p-6 rounded-2xl bg-gradient-to-br from-[#0e1633] to-[#0a0f24] border border-purple-800/50 shadow-xl space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-purple-500/20 text-purple-300 border border-purple-500/30">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white font-tech uppercase">
                PANEL SIMULATOR PERANGKAT KERAS (PENGUJIAN & DEMO)
              </h3>
              <p className="text-[11px] text-purple-300/80">
                Gunakan simulator virtual untuk menguji seluruh respons dashboard tanpa perlu menghubungkan kabel USB fisik.
              </p>
            </div>
          </div>

          <button
            onClick={onToggleSimulator}
            className={`px-4 py-2 rounded-xl text-xs font-bold font-mono-code transition-all ${
              isSimulated
                ? 'bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40'
                : 'bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-600/30'
            }`}
          >
            {isSimulated ? 'HENTIKAN SIMULASI' : 'AKTIFKAN SIMULASI ESP32'}
          </button>
        </div>

        {isSimulated ? (
          <div className="pt-4 border-t border-purple-800/40 space-y-4">
            <div className="text-xs text-purple-200 font-mono-code">
              Pemicu Event Virtual ESP32 (Mengirimkan baris JSON instan):
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button
                onClick={() => onSimulateDoorToggle('OPEN')}
                className="flex items-center justify-center gap-2 p-3 rounded-xl bg-amber-950/40 hover:bg-amber-900/60 border border-amber-600/60 text-amber-300 text-xs font-bold font-tech transition-all"
              >
                <DoorOpen className="w-4 h-4" />
                <span>Simulasikan BUKA Pintu</span>
              </button>

              <button
                onClick={() => onSimulateDoorToggle('CLOSED')}
                className="flex items-center justify-center gap-2 p-3 rounded-xl bg-emerald-950/40 hover:bg-emerald-900/60 border border-emerald-600/60 text-emerald-300 text-xs font-bold font-tech transition-all"
              >
                <DoorClosed className="w-4 h-4" />
                <span>Simulasikan TUTUP Pintu</span>
              </button>

              <button
                onClick={onSimulateNewPeriod}
                className="flex items-center justify-center gap-2 p-3 rounded-xl bg-cyan-950/40 hover:bg-cyan-900/60 border border-cyan-600/60 text-cyan-300 text-xs font-bold font-tech transition-all"
              >
                <KeyRound className="w-4 h-4" />
                <span>Ganti Periode & PIN Baru</span>
              </button>
            </div>

            <div className="flex justify-end">
              <button
                onClick={onSimulateRtcError}
                className="text-xs font-mono-code text-rose-400 hover:text-rose-300 underline"
              >
                Uji Skenario: Picu Kesalahan RTC DS1302 Error
              </button>
            </div>
          </div>
        ) : (
          <div className="text-xs text-slate-400 font-mono-code bg-black/40 p-3 rounded-xl border border-slate-800">
            Simulator sedang nonaktif. Dashboard berjalan dalam mode hardware Web Serial asli yang mendengarkan USB COM port.
          </div>
        )}
      </div>

      {/* Device Specifications Info */}
      <div className="p-6 rounded-2xl bg-[#0c1326] border border-slate-800/80 text-xs text-slate-400 space-y-3 font-mono-code">
        <div className="flex items-center gap-2 text-white font-bold font-tech text-sm">
          <ShieldCheck className="w-4 h-4 text-cyan-400" />
          SPESIFIKASI TEKNIS SISTEM SMART PARCEL BOX
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-[11px]">
          <div>• <strong>MCU Master:</strong> ESP32 WROOM-32 (Dual Core 240MHz)</div>
          <div>• <strong>MCU Slave:</strong> Arduino Uno R3 (ATmega328P 16MHz)</div>
          <div>• <strong>RTC IC:</strong> Maxim DS1302 Real-Time Clock Module</div>
          <div>• <strong>Sensor Pintu:</strong> Normally Closed Magnetic Reed Switch</div>
          <div>• <strong>Kriptografi:</strong> HMAC-SHA256 (TOTP Dynamic Truncation)</div>
          <div>• <strong>Periode Valid:</strong> 43,200 detik (12 Jam)</div>
          <div>• <strong>Komunikasi 1:</strong> USB Serial CDC (Browser Web Serial)</div>
          <div>• <strong>Komunikasi 2:</strong> Hardware UART2 (GPIO16/GPIO17) ke Uno</div>
        </div>
      </div>
    </div>
  );
};
