import React, { useState } from 'react';
import { 
  ScrollText, 
  Trash2, 
  Download, 
  Terminal, 
  Filter, 
  CheckCircle2, 
  AlertTriangle, 
  DoorOpen, 
  DoorClosed, 
  Clock, 
  KeyRound, 
  Usb, 
  Info 
} from 'lucide-react';
import { ActivityLog, LogEventType, SerialLineEntry } from '../types/serial';

interface ActivityLogsViewProps {
  logs: ActivityLog[];
  rawLines: SerialLineEntry[];
  onClearLogs: () => void;
}

export const ActivityLogsView: React.FC<ActivityLogsViewProps> = ({
  logs,
  rawLines,
  onClearLogs,
}) => {
  const [filterType, setFilterType] = useState<string>('ALL');
  const [activeTab, setActiveTab] = useState<'events' | 'raw'>('events');

  const getLogBadge = (type: LogEventType) => {
    switch (type) {
      case 'CONNECT':
        return {
          icon: Usb,
          color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40',
          label: 'KONEKSI',
        };
      case 'DISCONNECT':
        return {
          icon: Usb,
          color: 'bg-slate-800 text-slate-400 border-slate-700',
          label: 'TERPUTUS',
        };
      case 'RTC_OK':
        return {
          icon: Clock,
          color: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40',
          label: 'RTC OK',
        };
      case 'RTC_ERROR':
        return {
          icon: AlertTriangle,
          color: 'bg-rose-500/20 text-rose-400 border-rose-500/40',
          label: 'RTC ERROR',
        };
      case 'PIN_CHANGE':
        return {
          icon: KeyRound,
          color: 'bg-purple-500/20 text-purple-400 border-purple-500/40',
          label: 'PERIODE PIN',
        };
      case 'DOOR_OPEN':
        return {
          icon: DoorOpen,
          color: 'bg-amber-500/20 text-amber-400 border-amber-500/40',
          label: 'PINTU BUKA',
        };
      case 'DOOR_CLOSED':
        return {
          icon: DoorClosed,
          color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40',
          label: 'PINTU TUTUP',
        };
      case 'ERROR':
        return {
          icon: AlertTriangle,
          color: 'bg-rose-500/20 text-rose-400 border-rose-500/40',
          label: 'ERROR',
        };
      default:
        return {
          icon: Info,
          color: 'bg-slate-800 text-slate-400 border-slate-700',
          label: 'INFO',
        };
    }
  };

  const filteredLogs = logs.filter((log) => {
    if (filterType === 'ALL') return true;
    if (filterType === 'DOOR') return log.type === 'DOOR_OPEN' || log.type === 'DOOR_CLOSED';
    if (filterType === 'RTC') return log.type === 'RTC_OK' || log.type === 'RTC_ERROR';
    if (filterType === 'PIN') return log.type === 'PIN_CHANGE';
    if (filterType === 'CONNECT') return log.type === 'CONNECT' || log.type === 'DISCONNECT';
    if (filterType === 'ERROR') return log.type === 'ERROR' || log.type === 'RTC_ERROR';
    return true;
  });

  const exportLogs = () => {
    const textContent = logs
      .map((l) => `[${l.timestamp}] [${l.type}] ${l.message} ${l.details ? `(${l.details})` : ''}`)
      .join('\n');
    const blob = new Blob([textContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `smart-parcel-box-logs-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header and Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-white tracking-wide font-tech flex items-center gap-2.5">
            <ScrollText className="w-6 h-6 text-cyan-400" />
            RIWAYAT AKTIVITAS & STREAM LOGS
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Pencatatan sesi realtime untuk status koneksi, pintu, RTC, dan perubahan siklus PIN.
          </p>
        </div>

        {/* View Switcher: Events vs Raw Terminal */}
        <div className="flex items-center gap-2">
          <div className="p-1 rounded-xl bg-slate-900 border border-slate-800 flex items-center">
            <button
              onClick={() => setActiveTab('events')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold font-tech transition-colors ${
                activeTab === 'events'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Event Terstruktur ({logs.length})
            </button>
            <button
              onClick={() => setActiveTab('raw')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold font-tech transition-colors ${
                activeTab === 'raw'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Terminal className="w-3.5 h-3.5" />
              Raw Serial Stream ({rawLines.length})
            </button>
          </div>

          <button
            onClick={exportLogs}
            disabled={logs.length === 0}
            title="Download Logs"
            aria-label="Unduh Log Aktivitas"
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs font-medium disabled:opacity-40"
          >
            <Download className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden sm:inline">Export</span>
          </button>

          <button
            onClick={onClearLogs}
            disabled={logs.length === 0 && rawLines.length === 0}
            title="Hapus Semua Log"
            aria-label="Hapus Log Aktivitas"
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 border border-rose-900/60 text-rose-300 text-xs font-medium disabled:opacity-40"
          >
            <Trash2 className="w-3.5 h-3.5 text-rose-400" />
            <span className="hidden sm:inline">Bersihkan</span>
          </button>
        </div>
      </div>

      {activeTab === 'events' ? (
        <div className="space-y-4">
          {/* Filter Pills */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-500 font-mono-code flex items-center gap-1">
              <Filter className="w-3.5 h-3.5" /> Filter:
            </span>
            {[
              { id: 'ALL', label: 'Semua' },
              { id: 'DOOR', label: 'Pintu (Reed)' },
              { id: 'RTC', label: 'RTC DS1302' },
              { id: 'PIN', label: 'Siklus PIN' },
              { id: 'CONNECT', label: 'Koneksi USB' },
              { id: 'ERROR', label: 'Kesalahan' },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setFilterType(f.id)}
                className={`px-3 py-1 rounded-lg text-xs font-mono-code transition-all ${
                  filterType === f.id
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-semibold'
                    : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Table / List */}
          <div className="rounded-2xl bg-[#0c1326] border border-slate-800/80 overflow-hidden shadow-xl">
            {filteredLogs.length > 0 ? (
              <div className="divide-y divide-slate-800/80 max-h-[500px] overflow-y-auto">
                {filteredLogs.map((log) => {
                  const badge = getLogBadge(log.type);
                  const Icon = badge.icon;
                  return (
                    <div
                      key={log.id}
                      className="p-4 hover:bg-slate-900/40 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-start sm:items-center gap-3">
                        <span className={`p-2 rounded-lg border shrink-0 ${badge.color}`}>
                          <Icon className="w-4 h-4" />
                        </span>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] uppercase font-bold font-mono-code px-2 py-0.5 rounded border ${badge.color}`}>
                              {badge.label}
                            </span>
                            <span className="font-semibold text-slate-200">{log.message}</span>
                          </div>
                          {log.details && (
                            <p className="text-[11px] text-slate-400 font-mono-code mt-0.5">
                              {log.details}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="text-[11px] text-slate-500 font-mono-code shrink-0 sm:text-right">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-16 text-center text-slate-500 font-mono-code space-y-2">
                <ScrollText className="w-10 h-10 mx-auto text-slate-700" />
                <p className="text-sm">Belum ada riwayat aktivitas yang tercatat pada sesi ini.</p>
                <p className="text-xs text-slate-600">
                  Log akan terisi otomatis saat status ESP32, RTC, atau pintu mengalami perubahan.
                </p>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Raw Serial Stream Terminal */
        <div className="rounded-2xl bg-black border border-cyan-900/50 p-4 shadow-2xl font-mono-code text-xs space-y-3">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800 text-slate-400">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-cyan-400 font-bold">TERMINAL ALIRAN SERIAL (JSON INCOMING)</span>
            </div>
            <span className="text-[11px] text-slate-500">{rawLines.length} baris terbaca</span>
          </div>

          <div className="h-96 overflow-y-auto space-y-1.5 pr-2 font-mono-code text-[11px]">
            {rawLines.length > 0 ? (
              rawLines.map((line) => (
                <div key={line.id} className="flex items-start gap-2 text-slate-300">
                  <span className="text-slate-600 select-none shrink-0">{line.time}</span>
                  <span className="text-cyan-500 select-none">&gt;</span>
                  <span className={`break-all ${line.error ? 'text-rose-400' : 'text-emerald-300'}`}>
                    {line.raw}
                  </span>
                </div>
              ))
            ) : (
              <div className="h-full flex items-center justify-center text-slate-600">
                Menunggu baris data serial USB dari ESP32...
              </div>
            )}
          </div>
        </div>
      )}

      {/* Security Note */}
      <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 text-[11px] text-slate-400 flex items-center gap-2">
        <Info className="w-4 h-4 text-cyan-400 shrink-0" />
        <span>
          <strong>Kebijakan Keamanan:</strong> Riwayat ini hanya disimpan sementara di RAM browser selama sesi berjalan. PIN historis tidak disimpan permanen di penyimpanan lokal untuk mencegah kebocoran kredensial.
        </span>
      </div>
    </div>
  );
};
