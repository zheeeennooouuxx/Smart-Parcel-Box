import React, { useState } from 'react';
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
  KeyRound, 
  ShieldCheck, 
  Globe,
  Wifi,
  Signal,
  Usb,
  Radio,
  Server
} from 'lucide-react';
import { WebSerialManager } from '../services/webSerialManager';
import { ConnectionType, WifiConfig } from '../types/serial';

interface SettingsViewProps {
  connectionType: ConnectionType;
  onConnectionTypeChange: (type: ConnectionType) => void;
  baudRate: number;
  onBaudRateChange: (rate: number) => void;
  wifiConfig: WifiConfig;
  onWifiConfigChange: (config: Partial<WifiConfig>) => void;
  isSimulated: boolean;
  onToggleSimulator: () => void;
  onSimulateDoorToggle: (state: 'OPEN' | 'CLOSED') => void;
  onSimulateRtcError: () => void;
  onSimulateNewPeriod: () => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
  onTestPingWifi?: () => Promise<{ success: boolean; latencyMs?: number; error?: string; details?: string }>;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  connectionType,
  onConnectionTypeChange,
  baudRate,
  onBaudRateChange,
  wifiConfig,
  onWifiConfigChange,
  isSimulated,
  onToggleSimulator,
  onSimulateDoorToggle,
  onSimulateRtcError,
  onSimulateNewPeriod,
  soundEnabled,
  onToggleSound,
  onTestPingWifi,
}) => {
  const isWebSerialSupported = WebSerialManager.isSupported();
  const baudRates = [9600, 19200, 38400, 57600, 115200];
  const [pingResult, setPingResult] = useState<{ success: boolean; latencyMs?: number; msg: string } | null>(null);
  const [isPinging, setIsPinging] = useState(false);

  const handlePing = async () => {
    if (!onTestPingWifi) return;
    setIsPinging(true);
    setPingResult(null);
    try {
      const res = await onTestPingWifi();
      setPingResult({
        success: res.success,
        latencyMs: res.latencyMs,
        msg: res.success ? (res.details || 'Ping sukses') : (res.error || 'Gagal terhubung ke ESP32 Hotspot'),
      });
    } catch (err: unknown) {
      const error = err as Error;
      setPingResult({ success: false, msg: error.message });
    } finally {
      setIsPinging(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Title */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-400">
          <Settings className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-white font-tech">
            PENGATURAN KONEKSI & PERANGKAT
          </h2>
          <p className="text-xs text-slate-400">
            Pilih metode komunikasi (USB Serial atau WiFi Hotspot), konfigurasi endpoint, dan uji koneksi.
          </p>
        </div>
      </div>

      {/* Primary Connection Mode Selector */}
      <div className="p-6 rounded-2xl bg-[#0c1326] border border-cyan-500/30 space-y-4">
        <div className="flex items-center justify-between">
          <div className="text-sm font-bold text-white font-tech flex items-center gap-2">
            <Radio className="w-4 h-4 text-cyan-400" />
            METODE KONEKSI UTAMA KE ESP32
          </div>
          <span className="text-[11px] font-mono-code px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800">
            Aktif: {connectionType === 'WIFI' ? 'WiFi Hotspot' : 'USB Serial'}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* USB Serial Option */}
          <div
            onClick={() => onConnectionTypeChange('SERIAL')}
            className={`p-4 rounded-xl border cursor-pointer transition-all ${
              connectionType === 'SERIAL'
                ? 'bg-cyan-950/40 border-cyan-400 text-white shadow-lg shadow-cyan-950/50'
                : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${connectionType === 'SERIAL' ? 'bg-cyan-500 text-slate-950' : 'bg-slate-800 text-slate-400'}`}>
                  <Usb className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-bold font-tech text-sm">USB Serial (Web Serial API)</div>
                  <div className="text-[11px] text-slate-400">Kabel data USB langsung via COM port @9600 baud</div>
                </div>
              </div>
              <input
                type="radio"
                checked={connectionType === 'SERIAL'}
                onChange={() => onConnectionTypeChange('SERIAL')}
                className="mt-1"
              />
            </div>
          </div>

          {/* WiFi Hotspot Option */}
          <div
            onClick={() => onConnectionTypeChange('WIFI')}
            className={`p-4 rounded-xl border cursor-pointer transition-all ${
              connectionType === 'WIFI'
                ? 'bg-blue-950/40 border-blue-400 text-white shadow-lg shadow-blue-950/50'
                : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${connectionType === 'WIFI' ? 'bg-blue-500 text-slate-950' : 'bg-slate-800 text-slate-400'}`}>
                  <Wifi className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-bold font-tech text-sm">WiFi Hotspot (SoftAP)</div>
                  <div className="text-[11px] text-slate-400">Nirkabel ke SSID ESP32 (Default: 192.168.4.1)</div>
                </div>
              </div>
              <input
                type="radio"
                checked={connectionType === 'WIFI'}
                onChange={() => onConnectionTypeChange('WIFI')}
                className="mt-1"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Grid: WiFi Hotspot Settings & Serial Settings */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* WiFi Hotspot Configuration Card */}
        <div className="p-6 rounded-2xl bg-[#0c1326] border border-blue-900/40 space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-blue-400 font-tech font-bold text-sm">
              <Wifi className="w-4 h-4" />
              KONFIGURASI WIFI HOTSPOT ESP32
            </div>
            <span className="text-[10px] font-mono-code px-2 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800">
              SoftAP 802.11 b/g/n
            </span>
          </div>

          <div className="space-y-3 text-xs font-mono-code">
            <div>
              <label className="text-slate-300 font-semibold block mb-1">
                SSID Hotspot ESP32:
              </label>
              <input
                type="text"
                value={wifiConfig.ssid}
                onChange={(e) => onWifiConfigChange({ ssid: e.target.value })}
                placeholder="SMART-PARCEL-BOX-AP"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-cyan-300 outline-none focus:border-cyan-500"
              />
              <span className="text-[11px] text-slate-500 mt-1 block">
                Password Hotspot Bawaan: <code>12345678</code>
              </span>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="text-slate-300 font-semibold block mb-1">
                  IP Gateway ESP32:
                </label>
                <input
                  type="text"
                  value={wifiConfig.ip}
                  onChange={(e) => onWifiConfigChange({ ip: e.target.value })}
                  placeholder="192.168.4.1"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-cyan-300 font-bold outline-none focus:border-cyan-500"
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

            <div>
              <label className="text-slate-300 font-semibold block mb-1">
                Interval Polling Data Hotspot:
              </label>
              <div className="grid grid-cols-4 gap-2">
                {[1000, 2000, 3000, 5000].map((ms) => (
                  <button
                    key={ms}
                    type="button"
                    onClick={() => onWifiConfigChange({ intervalMs: ms })}
                    className={`py-1.5 px-2 rounded-lg border text-center transition-all ${
                      wifiConfig.intervalMs === ms
                        ? 'bg-blue-500 text-slate-950 font-bold border-blue-400'
                        : 'bg-slate-900 border-slate-800 text-slate-400'
                    }`}
                  >
                    {ms / 1000}s
                  </button>
                ))}
              </div>
            </div>

            {/* Test Ping Action */}
            <div className="pt-2">
              <button
                type="button"
                onClick={handlePing}
                disabled={isPinging}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-blue-950 hover:bg-blue-900 text-blue-300 border border-blue-700/60 font-tech font-bold transition-colors"
              >
                <Signal className={`w-4 h-4 ${isPinging ? 'animate-pulse' : ''}`} />
                <span>{isPinging ? 'Menguji Ping...' : 'Uji Sambungan (Ping ESP32)'}</span>
              </button>
            </div>

            {pingResult && (
              <div className={`p-3 rounded-xl border ${
                pingResult.success
                  ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-300'
                  : 'bg-rose-950/40 border-rose-500/50 text-rose-300'
              }`}>
                <div className="flex items-center gap-1.5 font-bold font-tech text-xs">
                  {pingResult.success ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                  <span>{pingResult.success ? `Tersambung (${pingResult.latencyMs}ms)` : 'Gagal Ping'}</span>
                </div>
                <p className="text-[11px] mt-1 leading-relaxed opacity-90">{pingResult.msg}</p>
              </div>
            )}
          </div>
        </div>

        {/* Serial Configuration Card */}
        <div className="p-6 rounded-2xl bg-[#0c1326] border border-slate-800/80 space-y-5">
          <div className="flex items-center gap-2 text-cyan-400 font-tech font-bold text-sm">
            <Sliders className="w-4 h-4" />
            KONFIGURASI PORT USB SERIAL
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

          {/* Web Serial API Compatibility Badge */}
          <div className="pt-3 border-t border-slate-800/80">
            <div className={`p-3 rounded-xl border flex items-center gap-2.5 text-xs ${
              isWebSerialSupported
                ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300'
                : 'bg-amber-950/20 border-amber-500/30 text-amber-300'
            }`}>
              {isWebSerialSupported ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> : <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />}
              <span>
                {isWebSerialSupported
                  ? 'Browser mendukung Web Serial API (Chrome/Edge).'
                  : 'Web Serial tidak didukung browser ini. Gunakan metode WiFi Hotspot.'}
              </span>
            </div>
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
                Gunakan simulator virtual untuk menguji seluruh respons dashboard baik via mode USB Serial maupun WiFi Hotspot.
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
              Pemicu Event Virtual ESP32 (Mengirimkan data instan ke dashboard):
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
            Simulator sedang nonaktif. Dashboard mendengarkan perangkat keras nyata sesuai mode yang dipilih ({connectionType === 'WIFI' ? 'WiFi Hotspot' : 'USB Serial'}).
          </div>
        )}
      </div>

      {/* Guide: How to connect to ESP32 WiFi Hotspot */}
      <div className="p-6 rounded-2xl bg-[#0c1326] border border-slate-800/80 space-y-4">
        <div className="flex items-center gap-2 text-white font-bold font-tech text-sm">
          <Server className="w-4 h-4 text-cyan-400" />
          PANDUAN MENGHUBUNGKAN VIA WIFI HOTSPOT ESP32
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs font-mono-code">
          <div className="bg-slate-900/80 p-3.5 rounded-xl border border-slate-800 space-y-1.5">
            <div className="text-cyan-400 font-bold">LANGKAH 1</div>
            <div className="text-slate-300 font-semibold">Nyalakan ESP32</div>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              Pastikan sketch firmware ESP32 sudah berjalan dan memancarkan SoftAP <code>SMART-PARCEL-BOX-AP</code>.
            </p>
          </div>

          <div className="bg-slate-900/80 p-3.5 rounded-xl border border-slate-800 space-y-1.5">
            <div className="text-cyan-400 font-bold">LANGKAH 2</div>
            <div className="text-slate-300 font-semibold">Sambungkan HP/Laptop</div>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              Buka menu WiFi pada komputer atau smartphone Anda, pilih <code>SMART-PARCEL-BOX-AP</code>, lalu masukkan password: <code>12345678</code>.
            </p>
          </div>

          <div className="bg-slate-900/80 p-3.5 rounded-xl border border-slate-800 space-y-1.5">
            <div className="text-cyan-400 font-bold">LANGKAH 3</div>
            <div className="text-slate-300 font-semibold">Cek IP Gateway</div>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              IP gateway standar ESP32 SoftAP adalah <code>192.168.4.1</code> pada port <code>80</code>.
            </p>
          </div>

          <div className="bg-slate-900/80 p-3.5 rounded-xl border border-slate-800 space-y-1.5">
            <div className="text-cyan-400 font-bold">LANGKAH 4</div>
            <div className="text-slate-300 font-semibold">Klik "CONNECT WIFI"</div>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              Dashboard akan otomatis menarik status, PIN dinamis 6 digit, status pintu, dan waktu RTC secara live!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
