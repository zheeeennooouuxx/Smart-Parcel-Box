import React from 'react';
import { 
  LayoutDashboard, 
  KeyRound, 
  Cpu, 
  ScrollText, 
  Code2, 
  Settings,
  CircleDot,
  DoorClosed,
  Clock
} from 'lucide-react';
import { ParcelBoxState } from '../types/serial';

export type ActiveTab = 'dashboard' | 'pin-access' | 'device' | 'logs' | 'firmware' | 'settings';

interface SidebarProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  state: ParcelBoxState;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onTabChange,
  state,
}) => {
  const navItems = [
    {
      id: 'dashboard' as ActiveTab,
      label: 'Dashboard',
      sublabel: 'Ringkasan & Status',
      icon: LayoutDashboard,
    },
    {
      id: 'pin-access' as ActiveTab,
      label: 'PIN Access',
      sublabel: 'PIN Dinamis 6-Digit',
      icon: KeyRound,
      badge: state.pin ? 'ACTIVE' : undefined,
      badgeColor: state.rtcStatus === 'OK' ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40' : 'bg-slate-800 text-slate-400',
    },
    {
      id: 'device' as ActiveTab,
      label: 'Device Monitoring',
      sublabel: 'ESP32, RTC, Reed Switch',
      icon: Cpu,
    },
    {
      id: 'logs' as ActiveTab,
      label: 'Activity Logs',
      sublabel: 'Riwayat & Serial Raw',
      icon: ScrollText,
      badge: state.rxPacketCount > 0 ? `${state.rxPacketCount}` : undefined,
    },
    {
      id: 'firmware' as ActiveTab,
      label: 'Firmware Guide',
      sublabel: 'ESP32 & Arduino Uno Code',
      icon: Code2,
    },
    {
      id: 'settings' as ActiveTab,
      label: 'Settings',
      sublabel: 'Baud Rate & Opsi',
      icon: Settings,
    },
  ];

  return (
    <>
      {/* Mobile Horizontal Navigation Bar (< lg) */}
      <nav 
        className="lg:hidden w-full bg-[#0a0f1d] border-b border-slate-800/80 px-3 py-2 flex items-center gap-1.5 overflow-x-auto shrink-0 scrollbar-none z-20"
        aria-label="Mobile Navigation"
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl whitespace-nowrap text-xs font-semibold font-tech shrink-0 transition-all ${
                isActive
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 shadow-sm shadow-cyan-950/40'
                  : 'bg-slate-900/60 text-slate-400 hover:text-white border border-slate-800/80'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{item.label}</span>
              {item.badge && (
                <span className={`text-[9px] px-1.5 py-0.2 rounded-full border ${item.badgeColor || 'bg-slate-800 text-slate-400'}`}>
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Desktop Vertical Sidebar (>= lg) */}
      <aside className="hidden lg:flex w-64 bg-[#0a0f1d] border-r border-slate-800/80 p-4 flex-col justify-between shrink-0">
        <div className="space-y-6">
          {/* Navigation list */}
          <nav className="space-y-1.5" aria-label="Main Navigation">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onTabChange(item.id)}
                  className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-left transition-all group ${
                    isActive
                      ? 'bg-gradient-to-r from-cyan-950/80 to-blue-950/40 border border-cyan-500/40 text-cyan-300 shadow-md shadow-cyan-950/40'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`p-2 rounded-lg transition-colors ${
                        isActive
                          ? 'bg-cyan-500/20 text-cyan-400'
                          : 'bg-slate-900 text-slate-500 group-hover:text-slate-300'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="truncate">
                      <div className="text-sm font-semibold tracking-wide font-tech">
                        {item.label}
                      </div>
                      <div className="text-[11px] text-slate-500 truncate">
                        {item.sublabel}
                      </div>
                    </div>
                  </div>

                  {item.badge && (
                    <span
                      className={`text-[10px] font-mono-code px-2 py-0.5 rounded-full border ${
                        item.badgeColor || 'bg-slate-800 text-slate-400 border-slate-700'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Hardware Telemetry Snapshot Box in Sidebar */}
        <div className="mt-6 pt-4 border-t border-slate-800/80 space-y-3">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 font-mono-code flex items-center justify-between">
            <span>STATUS CEPAT</span>
            <CircleDot className={`w-3 h-3 ${state.connectionStatus === 'CONNECTED' ? 'text-emerald-400 animate-pulse' : 'text-slate-600'}`} />
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-slate-900/70 p-2.5 rounded-lg border border-slate-800/70">
              <div className="text-[10px] text-slate-500 flex items-center gap-1">
                <DoorClosed className="w-3 h-3" /> PINTU
              </div>
              <div className={`font-semibold font-mono-code text-[11px] mt-0.5 ${
                state.doorStatus === 'OPEN'
                  ? 'text-amber-400'
                  : state.doorStatus === 'CLOSED'
                  ? 'text-emerald-400'
                  : 'text-slate-500'
              }`}>
                {state.doorStatus === 'OPEN' ? 'TERBUKA' : state.doorStatus === 'CLOSED' ? 'TERKUNCI' : 'N/A'}
              </div>
            </div>

            <div className="bg-slate-900/70 p-2.5 rounded-lg border border-slate-800/70">
              <div className="text-[10px] text-slate-500 flex items-center gap-1">
                <Clock className="w-3 h-3" /> RTC DS1302
              </div>
              <div className={`font-semibold font-mono-code text-[11px] mt-0.5 ${
                state.rtcStatus === 'OK'
                  ? 'text-emerald-400'
                  : state.rtcStatus === 'ERROR'
                  ? 'text-rose-400'
                  : 'text-slate-500'
              }`}>
                {state.rtcStatus === 'OK' ? 'NORMAL' : state.rtcStatus === 'ERROR' ? 'ERROR' : 'N/A'}
              </div>
            </div>
          </div>

          <div className="text-[10px] text-slate-600 text-center font-mono-code pt-1">
            Smart Parcel Box v2.4 • Web Serial
          </div>
        </div>
      </aside>
    </>
  );
};
