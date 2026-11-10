import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  Terminal, 
  Send, 
  Trash2, 
  Download, 
  ArrowDown, 
  RotateCw, 
  Search, 
  Power, 
  Usb, 
  Copy, 
  Check, 
  Sliders, 
  FileCode, 
  Code2, 
  Binary, 
  AlertCircle,
  HelpCircle,
  Sparkles,
  KeyRound,
  ArrowRight,
  Signal,
  Wifi
} from 'lucide-react';
import { 
  SerialLineEntry, 
  SerialConnectionStatus, 
  LineEndingType,
  ConnectionType,
  WifiConfig
} from '../types/serial';

interface SerialMonitorViewProps {
  lines: SerialLineEntry[];
  connectionStatus: SerialConnectionStatus;
  connectionType?: ConnectionType;
  wifiConfig?: WifiConfig;
  portInfo?: string;
  baudRate: number;
  pin?: string;
  period?: number;
  onBaudRateChange: (rate: number) => void;
  onSendMessage: (text: string, ending: LineEndingType) => Promise<boolean>;
  onResetDevice: () => Promise<boolean>;
  onClearLogs: () => void;
  onConnect: () => void;
  onDisconnect: () => void;
  onGoToPinAccess?: () => void;
  onSwitchToWifi?: (ip?: string) => void;
}

export const SerialMonitorView: React.FC<SerialMonitorViewProps> = ({
  lines,
  connectionStatus,
  connectionType = 'SERIAL',
  wifiConfig,
  portInfo,
  baudRate,
  pin,
  period,
  onBaudRateChange,
  onSendMessage,
  onResetDevice,
  onClearLogs,
  onConnect,
  onDisconnect,
  onGoToPinAccess,
  onSwitchToWifi,
}) => {
  const [inputText, setInputText] = useState('');
  const [lineEnding, setLineEnding] = useState<LineEndingType>('NL');
  const [autoScroll, setAutoScroll] = useState(true);
  const [showTimestamps, setShowTimestamps] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'text' | 'json' | 'hex'>('text');
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const [isSending, setIsSending] = useState(false);
  const [copied, setCopied] = useState(false);
  const [resetting, setResetting] = useState(false);

  const terminalEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const isConnected = connectionStatus === 'CONNECTED';

  // Auto-scroll to bottom when new lines arrive
  useEffect(() => {
    if (autoScroll && terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [lines, autoScroll]);

  const handleSend = async (customCmd?: string) => {
    const textToSend = customCmd !== undefined ? customCmd : inputText;
    if (!textToSend.trim() && customCmd === undefined) return;

    try {
      setIsSending(true);
      await onSendMessage(textToSend, lineEnding);
      
      if (customCmd === undefined) {
        setCommandHistory((prev) => [textToSend, ...prev.slice(0, 49)]);
        setHistoryIndex(-1);
        setInputText('');
      }
    } catch (err: unknown) {
      const error = err as Error;
      alert(`Gagal mengirim ke port serial: ${error.message}`);
    } finally {
      setIsSending(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSend();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (commandHistory.length > 0 && historyIndex < commandHistory.length - 1) {
        const nextIndex = historyIndex + 1;
        setHistoryIndex(nextIndex);
        setInputText(commandHistory[nextIndex]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex > 0) {
        const prevIndex = historyIndex - 1;
        setHistoryIndex(prevIndex);
        setInputText(commandHistory[prevIndex]);
      } else if (historyIndex === 0) {
        setHistoryIndex(-1);
        setInputText('');
      }
    }
  };

  const handleResetDevice = async () => {
    if (!confirm('Picu Reset Hardware ESP32 (DTR/RTS Toggle)?')) return;
    setResetting(true);
    await onResetDevice();
    setTimeout(() => setResetting(false), 500);
  };

  const handleCopyAll = async () => {
    const text = lines.map(l => `${l.time} [${l.direction || 'RX'}] ${l.raw}`).join('\n');
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExport = () => {
    const text = lines.map(l => `${l.time} [${l.direction || 'RX'}] ${l.raw}`).join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `esp32-serial-monitor-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.log`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Convert string to hex representation
  const stringToHex = (str: string): string => {
    return Array.from(str)
      .map(c => c.charCodeAt(0).toString(16).padStart(2, '0').toUpperCase())
      .join(' ');
  };

  // Filter lines
  const filteredLines = useMemo(() => {
    if (!searchQuery.trim()) return lines;
    const q = searchQuery.toLowerCase();
    return lines.filter(l => l.raw.toLowerCase().includes(q) || l.time.includes(q));
  }, [lines, searchQuery]);

  return (
    <div className="space-y-4 max-w-6xl mx-auto flex flex-col h-[calc(100vh-140px)]">
      {/* Top Header & Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#0a0f1d] p-3.5 rounded-2xl border border-slate-800 shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-400">
            <Terminal className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-white font-tech tracking-wide">
                {connectionType === 'WIFI' ? 'TERMINAL WIFI HOTSPOT ESP32' : 'SERIAL MONITOR ESP32'}
              </h2>
              <span className={`text-[10px] font-mono-code font-bold px-2 py-0.5 rounded-full border ${
                isConnected
                  ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
                  : 'bg-slate-800 border-slate-700 text-slate-400'
              }`}>
                {isConnected ? (connectionType === 'WIFI' ? 'HOTSPOT AKTIF' : 'PORT DIBUKA') : 'OFFLINE'}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-mono-code">
              {isConnected 
                ? (connectionType === 'WIFI' 
                    ? `SoftAP ${wifiConfig?.ssid || 'SMART-PARCEL-BOX-AP'} (${wifiConfig?.ip || '192.168.4.1'}:${wifiConfig?.port || 80})` 
                    : `${portInfo || 'ESP32 Port'} @${baudRate} baud`)
                : (connectionType === 'WIFI' 
                    ? `Menunggu koneksi WiFi Hotspot ${wifiConfig?.ssid || 'SMART-PARCEL-BOX-AP'}` 
                    : 'Belum terhubung ke port serial USB')}
            </p>
          </div>
        </div>

        {/* Toolbar Controls */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {/* Baud Rate Picker (for Serial) or IP info (for WiFi) */}
          {connectionType === 'SERIAL' ? (
            <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 font-mono-code text-slate-300">
              <Sliders className="w-3.5 h-3.5 text-cyan-400" />
              <select
                value={baudRate}
                onChange={(e) => onBaudRateChange(Number(e.target.value))}
                aria-label="Pilih Baud Rate"
                className="bg-transparent text-cyan-300 font-bold outline-none cursor-pointer"
              >
                <option value={9600} className="bg-slate-900 text-slate-200">9600 baud</option>
                <option value={19200} className="bg-slate-900 text-slate-200">19200 baud</option>
                <option value={38400} className="bg-slate-900 text-slate-200">38400 baud</option>
                <option value={57600} className="bg-slate-900 text-slate-200">57600 baud</option>
                <option value={115200} className="bg-slate-900 text-slate-200">115200 baud</option>
              </select>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 font-mono-code text-blue-300 text-[11px]">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-400"></span>
              <span>{wifiConfig?.ip || '192.168.4.1'}:{wifiConfig?.port || 80}</span>
            </div>
          )}

          {/* Reset ESP32 Button */}
          <button
            onClick={handleResetDevice}
            disabled={!isConnected || resetting}
            title="Reset ESP32 Hardware (DTR/RTS line pulse)"
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-amber-300 font-tech font-semibold disabled:opacity-40 transition-colors"
          >
            <RotateCw className={`w-3.5 h-3.5 ${resetting ? 'animate-spin' : ''}`} />
            <span>Reset ESP</span>
          </button>

          {/* Connect / Disconnect toggle */}
          {isConnected ? (
            <button
              onClick={onDisconnect}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/60 text-rose-300 font-tech font-bold"
            >
              <Power className="w-3.5 h-3.5" />
              <span>Disconnect</span>
            </button>
          ) : (
            <button
              onClick={onConnect}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-tech font-bold shadow-md shadow-cyan-500/20"
            >
              {connectionType === 'WIFI' ? <Signal className="w-3.5 h-3.5" /> : <Usb className="w-3.5 h-3.5" />}
              <span>{connectionType === 'WIFI' ? 'Connect WiFi' : 'Connect COM4'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Synchronized PIN Access Banner when PIN is detected */}
      {pin && (
        <div className="flex flex-wrap items-center justify-between gap-3 bg-gradient-to-r from-[#0d1e3d] via-[#09152b] to-[#062022] p-3 rounded-2xl border border-cyan-500/40 shadow-lg shadow-cyan-950/30 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
              <KeyRound className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono-code text-cyan-400 font-bold uppercase tracking-wider">
                  PIN Akses Serial Terdeteksi
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-mono-code font-bold">
                  ACTIVE
                </span>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xl md:text-2xl font-black font-mono-code tracking-[0.25em] text-cyan-200">
                  {pin}
                </span>
                {period !== undefined && (
                  <span className="text-xs font-mono-code text-slate-400">
                    (Periode #{period})
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onGoToPinAccess && (
              <button
                onClick={onGoToPinAccess}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 text-xs font-tech font-bold tracking-wider shadow-md shadow-cyan-500/25 active:scale-95 transition-all cursor-pointer"
              >
                <span>BUKA TAB PIN ACCESS</span>
                <ArrowRight className="w-3.5 h-3.5 stroke-[2.5]" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Synchronized WiFi IP Banner when WiFi IP is detected from serial */}
      {wifiConfig?.ip && connectionType === 'SERIAL' && (
        <div className="flex flex-wrap items-center justify-between gap-3 bg-gradient-to-r from-blue-950/90 via-[#0a1835] to-slate-900 p-3 rounded-2xl border border-blue-500/40 shadow-lg shadow-blue-950/30 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-500/20 text-blue-300 border border-blue-500/30">
              <Signal className="w-5 h-5 animate-pulse text-cyan-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono-code text-cyan-400 font-bold uppercase tracking-wider">
                  Alamat IP ESP32 Tercatat Otomatis
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 font-mono-code font-bold">
                  {wifiConfig.ssid || 'AAA'}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2 mt-0.5 text-xs font-mono-code">
                <span className="text-base font-bold text-white font-mono-code">
                  {wifiConfig.ip}
                </span>
                {wifiConfig.gateway && (
                  <span className="text-slate-400 text-[11px]">
                    • Gateway: {wifiConfig.gateway}
                  </span>
                )}
                {wifiConfig.subnet && (
                  <span className="text-slate-400 text-[11px]">
                    • Mask: {wifiConfig.subnet}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onSwitchToWifi && (
              <button
                onClick={() => onSwitchToWifi(wifiConfig.ip)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-400 hover:to-cyan-400 text-slate-950 text-xs font-tech font-bold tracking-wider shadow-md shadow-blue-500/25 active:scale-95 transition-all cursor-pointer"
              >
                <span>BERALIH KE KONEKSI WIFI HOTSPOT</span>
                <ArrowRight className="w-3.5 h-3.5 stroke-[2.5]" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Quick Macros Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-[#0c1326]/60 p-2.5 rounded-xl border border-slate-800/80 text-xs shrink-0">
        <div className="flex items-center gap-1.5 overflow-x-auto py-0.5">
          <span className="text-[11px] font-mono-code text-slate-500 shrink-0 mr-1">
            Macro Cepat:
          </span>
          {[
            { label: 'STATUS', cmd: 'STATUS', desc: 'Minta info status JSON' },
            { label: 'GET PIN', cmd: 'PIN', desc: 'Minta PIN dinamis dari ESP32' },
            { label: 'PING', cmd: 'PING', desc: 'Uji respons PONG' },
            { label: 'OPEN DOOR', cmd: 'DOOR_OPEN', desc: 'Simulasi buka pintu' },
            { label: 'CLOSE DOOR', cmd: 'DOOR_CLOSED', desc: 'Simulasi tutup pintu' },
            { label: 'BEEP', cmd: 'BEEP', desc: 'Uji buzzer aktif' },
          ].map((macro) => (
            <button
              key={macro.cmd}
              onClick={() => handleSend(macro.cmd)}
              disabled={!isConnected}
              title={macro.desc}
              className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-cyan-950/60 text-slate-300 hover:text-cyan-300 border border-slate-800 hover:border-cyan-700/60 font-mono-code text-[11px] font-semibold whitespace-nowrap disabled:opacity-40 transition-colors"
            >
              {macro.label}
            </button>
          ))}
        </div>

        {/* View mode toggle */}
        <div className="flex items-center gap-1">
          <div className="p-0.5 rounded-lg bg-slate-950 border border-slate-800 flex items-center text-[11px] font-mono-code">
            <button
              onClick={() => setViewMode('text')}
              className={`px-2 py-0.5 rounded ${viewMode === 'text' ? 'bg-cyan-500/20 text-cyan-300 font-bold' : 'text-slate-400'}`}
            >
              RAW
            </button>
            <button
              onClick={() => setViewMode('json')}
              className={`px-2 py-0.5 rounded ${viewMode === 'json' ? 'bg-cyan-500/20 text-cyan-300 font-bold' : 'text-slate-400'}`}
            >
              JSON
            </button>
            <button
              onClick={() => setViewMode('hex')}
              className={`px-2 py-0.5 rounded ${viewMode === 'hex' ? 'bg-cyan-500/20 text-cyan-300 font-bold' : 'text-slate-400'}`}
            >
              HEX
            </button>
          </div>
        </div>
      </div>

      {/* Main Terminal Window */}
      <div className="flex-1 bg-black border border-cyan-950 rounded-2xl overflow-hidden flex flex-col shadow-2xl relative min-h-[300px]">
        {/* Terminal Sub-bar (Search & Actions) */}
        <div className="bg-[#090e1d] border-b border-slate-800/80 px-4 py-2 flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Search filter */}
          <div className="flex items-center gap-2 bg-black/60 border border-slate-800 rounded-lg px-2.5 py-1 max-w-xs w-full text-slate-300">
            <Search className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <input
              type="text"
              placeholder="Filter serial stream..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent text-xs font-mono-code outline-none w-full placeholder:text-slate-600"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="text-slate-500 hover:text-white">
                ✕
              </button>
            )}
          </div>

          {/* Controls: Timestamps, Autoscroll, Clear, Copy, Export */}
          <div className="flex items-center gap-3 font-mono-code text-[11px] text-slate-400">
            <label className="flex items-center gap-1.5 cursor-pointer hover:text-slate-200">
              <input
                type="checkbox"
                checked={showTimestamps}
                onChange={(e) => setShowTimestamps(e.target.checked)}
                className="rounded bg-slate-900 border-slate-700 text-cyan-500 focus:ring-0"
              />
              <span>Timestamp</span>
            </label>

            <label className="flex items-center gap-1.5 cursor-pointer hover:text-slate-200">
              <input
                type="checkbox"
                checked={autoScroll}
                onChange={(e) => setAutoScroll(e.target.checked)}
                className="rounded bg-slate-900 border-slate-700 text-cyan-500 focus:ring-0"
              />
              <span>Autoscroll</span>
            </label>

            <div className="h-3 w-px bg-slate-800" />

            <button
              onClick={handleCopyAll}
              title="Salin Semua Output"
              className="hover:text-cyan-400 flex items-center gap-1"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Tersalin' : 'Copy'}</span>
            </button>

            <button
              onClick={handleExport}
              title="Download Log Serial"
              className="hover:text-cyan-400 flex items-center gap-1"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export</span>
            </button>

            <button
              onClick={onClearLogs}
              title="Bersihkan Terminal"
              className="hover:text-rose-400 flex items-center gap-1"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear</span>
            </button>
          </div>
        </div>

        {/* Scrollable Terminal Output Screen */}
        <div className="flex-1 overflow-y-auto p-4 font-mono-code text-xs leading-relaxed space-y-1 select-text">
          {filteredLines.length > 0 ? (
            filteredLines.map((line) => {
              const isTx = line.direction === 'TX';
              const isError = line.error;
              const hasJson = Boolean(line.parsed);

              return (
                <div
                  key={line.id}
                  className={`flex items-start gap-2.5 py-0.5 px-1 rounded hover:bg-slate-900/50 transition-colors ${
                    isTx ? 'bg-cyan-950/20 text-cyan-200' : 'text-slate-200'
                  }`}
                >
                  {/* Timestamp */}
                  {showTimestamps && (
                    <span className="text-slate-600 select-none shrink-0 text-[11px]">
                      {line.time}
                    </span>
                  )}

                  {/* Direction Badge */}
                  <span
                    className={`select-none shrink-0 text-[9px] font-bold px-1.5 py-0.2 rounded ${
                      isTx
                        ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                        : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    }`}
                  >
                    {isTx ? 'TX' : 'RX'}
                  </span>

                  {/* Line Content based on View Mode */}
                  <div className="flex-1 break-all">
                    {viewMode === 'hex' ? (
                      <span className="text-purple-300 font-mono-code tracking-wider text-[11px]">
                        {stringToHex(line.raw)}
                      </span>
                    ) : viewMode === 'json' && hasJson ? (
                      <pre className="text-emerald-300 whitespace-pre-wrap font-mono-code text-[11px] bg-black/40 p-1.5 rounded border border-emerald-950/60">
                        {JSON.stringify(line.parsed, null, 2)}
                      </pre>
                    ) : (
                      <span className={
                        isTx
                          ? 'text-cyan-300 font-semibold'
                          : isError
                          ? 'text-rose-400'
                          : hasJson
                          ? 'text-emerald-300'
                          : 'text-slate-300'
                      }>
                        {line.raw}
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-slate-600 space-y-2 py-12">
              <Terminal className="w-10 h-10 text-slate-800" />
              <p className="text-sm">Terminal Serial Monitor siap.</p>
              <p className="text-xs text-slate-700">
                {isConnected 
                  ? 'Menunggu aliran data dari ESP32 atau ketik perintah di bawah...'
                  : 'Klik "Connect Port" atau aktifkan Simulasi untuk memulai komunikasi.'}
              </p>
            </div>
          )}
          <div ref={terminalEndRef} />
        </div>

        {/* Floating Quick Scroll to Bottom if autoScroll is disabled */}
        {!autoScroll && (
          <button
            onClick={() => terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' })}
            className="absolute bottom-16 right-6 p-2 rounded-full bg-cyan-500 text-slate-950 shadow-lg shadow-cyan-500/40 hover:bg-cyan-400 transition-all"
            title="Gulir ke Baris Terbawah"
          >
            <ArrowDown className="w-4 h-4 stroke-[3]" />
          </button>
        )}
      </div>

      {/* Input Bar (Arduino IDE Style) */}
      <div className="flex items-center gap-2 bg-[#0a0f1d] p-3 rounded-2xl border border-slate-800 shrink-0">
        <div className="flex-1 relative flex items-center">
          <input
            ref={inputRef}
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={!isConnected}
            placeholder={
              isConnected
                ? 'Ketik perintah serial ke ESP32 (misal: PING, STATUS, BEEP, DOOR_OPEN) lalu tekan Enter...'
                : 'Hubungkan port ESP32 terlebih dahulu untuk mengirim data serial...'
            }
            className="w-full bg-black/70 border border-slate-700/80 focus:border-cyan-500 rounded-xl px-4 py-2.5 text-xs text-cyan-200 font-mono-code outline-none placeholder:text-slate-600 disabled:opacity-50 transition-colors"
          />
          {inputText && (
            <button
              onClick={() => setInputText('')}
              className="absolute right-3 text-slate-500 hover:text-slate-300 text-xs"
            >
              ✕
            </button>
          )}
        </div>

        {/* Line Ending Selector */}
        <select
          value={lineEnding}
          onChange={(e) => setLineEnding(e.target.value as LineEndingType)}
          title="Akhiran Baris (Line Ending)"
          className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-xs font-mono-code text-slate-300 outline-none cursor-pointer hover:border-slate-600"
        >
          <option value="NL">Newline (\\n)</option>
          <option value="CR">Carriage Return (\\r)</option>
          <option value="NL_CR">Both NL & CR (\\r\\n)</option>
          <option value="NONE">No Line Ending</option>
        </select>

        {/* Send Button */}
        <button
          onClick={() => handleSend()}
          disabled={!isConnected || !inputText.trim() || isSending}
          className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 text-xs font-bold font-tech tracking-wider shadow-lg shadow-cyan-500/20 disabled:opacity-40 transition-all active:scale-95 shrink-0"
        >
          <Send className="w-3.5 h-3.5" />
          <span>KIRIM</span>
        </button>
      </div>
    </div>
  );
};
