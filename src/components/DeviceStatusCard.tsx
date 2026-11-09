import React from 'react';
import { 
  Cpu, 
  Clock, 
  DoorClosed, 
  DoorOpen, 
  Radio, 
  Activity, 
  CheckCircle2, 
  XCircle, 
  AlertCircle,
  Volume2,
  Layers
} from 'lucide-react';
import { ParcelBoxState } from '../types/serial';

interface DeviceStatusCardProps {
  state: ParcelBoxState;
}

export const DeviceStatusCard: React.FC<DeviceStatusCardProps> = ({ state }) => {
  const isConnected = state.connectionStatus === 'CONNECTED';
  const isConnecting = state.connectionStatus === 'CONNECTING';
  const isError = state.connectionStatus === 'ERROR' || state.rtcStatus === 'ERROR';

  // Overall system health
  const getOverallStatus = () => {
    if (state.connectionStatus === 'CONNECTED' && state.rtcStatus === 'OK') {
      return {
        label: 'SISTEM NORMAL & AMAN',
        color: 'text-emerald-400 bg-emerald-500/15 border-emerald-500/40',
        dot: 'bg-emerald-400',
        icon: CheckCircle2,
      };
    }
    if (state.connectionStatus === 'CONNECTING') {
      return {
        label: 'MENUNGGU INISIALISASI DATA',
        color: 'text-amber-400 bg-amber-500/15 border-amber-500/40',
        dot: 'bg-amber-400',
        icon: Activity,
      };
    }
    if (isError) {
      return {
        label: 'PERINGATAN SISTEM / KESALAHAN',
        color: 'text-rose-400 bg-rose-500/15 border-rose-500/40',
        dot: 'bg-rose-400',
        icon: XCircle,
      };
    }
    return {
      label: 'PERANGKAT STANDBY / OFFLINE',
      color: 'text-slate-400 bg-slate-800 border-slate-700',
      dot: 'bg-slate-500',
      icon: AlertCircle,
    };
  };

  const overall = getOverallStatus();
  const OverallIcon = overall.icon;

  const devices = [
    {
      name: 'ESP32 Controller',
      role: 'Pengelola RTC, Reed Switch, USB Serial, Buzzer',
      status: isConnected ? 'ONLINE' : isConnecting ? 'CONNECTING' : 'OFFLINE',
      statusColor: isConnected ? 'text-emerald-400' : isConnecting ? 'text-amber-400' : 'text-slate-500',
      icon: Cpu,
      detail: isConnected ? `${state.portInfo || 'USB Serial'} @${state.baudRate} baud` : 'Belum Terhubung',
    },
    {
      name: 'Modul RTC DS1302',
      role: 'Penyimpan waktu fisik untuk HMAC-SHA256',
      status: state.rtcStatus === 'OK' ? 'NORMAL' : state.rtcStatus === 'ERROR' ? 'ERROR' : 'UNKNOWN',
      statusColor: state.rtcStatus === 'OK' ? 'text-emerald-400' : state.rtcStatus === 'ERROR' ? 'text-rose-400' : 'text-slate-500',
      icon: Clock,
      detail: state.rtcStatus === 'OK' ? `${state.date} ${state.time}` : 'Tidak Siap',
    },
    {
      name: 'Reed Switch Pintu',
      role: 'Sensor magnetik deteksi buka/tutup parcel box',
      status: state.doorStatus === 'OPEN' ? 'OPEN' : state.doorStatus === 'CLOSED' ? 'CLOSED' : 'UNKNOWN',
      statusColor: state.doorStatus === 'CLOSED' ? 'text-emerald-400' : state.doorStatus === 'OPEN' ? 'text-amber-400' : 'text-slate-500',
      icon: state.doorStatus === 'OPEN' ? DoorOpen : DoorClosed,
      detail: state.doorStatus === 'OPEN' ? 'Pintu Terbuka' : state.doorStatus === 'CLOSED' ? 'Terkunci Rapat' : 'Standby',
    },
    {
      name: 'Arduino Uno (UART2)',
      role: 'Keypad 4x4, RFID RC522, LCD 1602, Servo Kunci',
      status: isConnected ? 'LINKED' : 'STANDBY',
      statusColor: isConnected ? 'text-cyan-400' : 'text-slate-500',
      icon: Layers,
      detail: isConnected ? 'GPIO16 RX / GPIO17 TX UART2 (9600 Baud)' : 'Menunggu ESP32',
    },
    {
      name: 'Buzzer Aktif',
      role: 'Indikator audio akses berhasil / ditolak',
      status: isConnected ? 'READY' : 'OFFLINE',
      statusColor: isConnected ? 'text-emerald-400' : 'text-slate-500',
      icon: Volume2,
      detail: isConnected ? 'BEEP_GRANTED / BEEP_DENIED' : 'Siap Bunyi',
    },
    {
      name: 'Throughput Serial USB',
      role: 'Aliran data realtime dari ESP32 ke Browser',
      status: isConnected ? 'STREAMING' : 'IDLE',
      statusColor: isConnected ? 'text-cyan-400' : 'text-slate-500',
      icon: Radio,
      detail: `${state.rxPacketCount} Paket diterima (${Math.round(state.rxBytesCount / 1024 * 10) / 10} KB)`,
    },
  ];

  return (
    <div className="rounded-2xl bg-gradient-to-br from-[#0c1326] to-[#070b16] border border-slate-800/80 p-6 shadow-xl space-y-6">
      {/* Header and Overall System Status */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white tracking-wide font-tech uppercase">
              STATUS PERANGKAT & KOMUNIKASI
            </h3>
            <span className="text-[11px] text-slate-400">
              Telemetri Modul Keras Smart Parcel Box
            </span>
          </div>
        </div>

        {/* Overall Status Pill */}
        <div className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full border text-xs font-bold font-mono-code ${overall.color}`}>
          <span className={`h-2 w-2 rounded-full ${overall.dot}`}></span>
          <OverallIcon className="w-3.5 h-3.5" />
          <span>{overall.label}</span>
        </div>
      </div>

      {/* Grid of hardware subsystems */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {devices.map((device, idx) => {
          const Icon = device.icon;
          return (
            <div
              key={idx}
              className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 hover:border-cyan-800/50 transition-colors flex flex-col justify-between"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-lg bg-slate-800/80 text-cyan-400">
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white font-tech">{device.name}</h4>
                    <span className="text-[10px] text-slate-400 block line-clamp-1">
                      {device.role}
                    </span>
                  </div>
                </div>
                <span className={`text-[10px] font-bold font-mono-code px-2 py-0.5 rounded bg-slate-950/80 border border-slate-800 ${device.statusColor}`}>
                  {device.status}
                </span>
              </div>

              <div className="mt-3 pt-2.5 border-t border-slate-800/60 flex items-center justify-between text-[11px] font-mono-code text-slate-400">
                <span className="truncate">{device.detail}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
