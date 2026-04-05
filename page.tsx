"use client";

// app/page.tsx — ARIA Voice IT Support Dashboard

import { useEffect, useRef, useState } from "react";
import {
  Mic,
  MicOff,
  Terminal,
  Ticket,
  Wifi,
  WifiOff,
  Shield,
  ShieldCheck,
  Package,
  User,
  ChevronRight,
  Activity,
  XCircle,
  CheckCircle2,
  Clock,
  Zap,
  Radio,
} from "lucide-react";
import { useVoiceAgent, type ConsoleEntry, type AgentStatus } from "@/hooks/useVoiceAgent";

// ── Status config ─────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<AgentStatus, { label: string; color: string; ring: string; pulse: boolean }> = {
  idle: { label: "STANDBY", color: "text-slate-400", ring: "ring-slate-600", pulse: false },
  listening: { label: "LISTENING", color: "text-emerald-400", ring: "ring-emerald-500", pulse: true },
  thinking: { label: "PROCESSING", color: "text-amber-400", ring: "ring-amber-500", pulse: true },
  speaking: { label: "RESPONDING", color: "text-sky-400", ring: "ring-sky-500", pulse: true },
  error: { label: "ERROR", color: "text-red-400", ring: "ring-red-500", pulse: false },
};

// ── Console log entry colours ─────────────────────────────────────────────────
const LOG_STYLE: Record<ConsoleEntry["type"], { prefix: string; color: string }> = {
  system: { prefix: "SYS", color: "text-slate-400" },
  think: { prefix: "THINK", color: "text-amber-400" },
  action: { prefix: "EXEC", color: "text-violet-400" },
  result: { prefix: "RES", color: "text-emerald-400" },
  speak: { prefix: "ARIA", color: "text-sky-400" },
  listen: { prefix: "USER", color: "text-teal-400" },
  error: { prefix: "ERR", color: "text-red-400" },
};

const TICKET_TYPE_ICON: Record<string, React.ReactNode> = {
  account_lockout: <Shield size={13} />,
  vpn_issue: <Wifi size={13} />,
  software_request: <Package size={13} />,
  general: <User size={13} />,
};

const TICKET_STATUS_STYLE: Record<string, string> = {
  open: "bg-amber-500/15 text-amber-400 border border-amber-500/30",
  in_progress: "bg-sky-500/15 text-sky-400 border border-sky-500/30",
  resolved: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30",
};

// ── Aura SVG ──────────────────────────────────────────────────────────────────
function VoiceAura({ status }: { status: AgentStatus }) {
  const cfg = STATUS_CONFIG[status];
  const rings = ["opacity-10", "opacity-20", "opacity-30"];
  const sizes = [280, 220, 160];

  const auraColor =
    status === "listening" ? "#10b981"
    : status === "thinking" ? "#f59e0b"
    : status === "speaking" ? "#38bdf8"
    : status === "error" ? "#ef4444"
    : "#475569";

  return (
    <div className="relative flex items-center justify-center" style={{ width: 320, height: 320 }}>
      {/* Outer rings */}
      {sizes.map((size, i) => (
        <div
          key={i}
          className="absolute rounded-full border transition-all duration-700"
          style={{
            width: size,
            height: size,
            borderColor: auraColor,
            opacity: cfg.pulse ? parseFloat(rings[i]) + 0.05 : 0.04,
            animation: cfg.pulse ? `ping ${1.4 + i * 0.3}s cubic-bezier(0,0,0.2,1) infinite` : "none",
            animationDelay: `${i * 200}ms`,
          }}
        />
      ))}

      {/* Core circle */}
      <div
        className={`relative z-10 flex flex-col items-center justify-center rounded-full ring-2 ${cfg.ring} transition-all duration-500`}
        style={{
          width: 120,
          height: 120,
          background: `radial-gradient(circle at 40% 35%, ${auraColor}22, ${auraColor}08 70%, transparent)`,
          boxShadow: cfg.pulse ? `0 0 40px 4px ${auraColor}33` : "none",
        }}
      >
        {status === "listening" ? (
          <Radio size={36} style={{ color: auraColor }} className="animate-pulse" />
        ) : status === "thinking" ? (
          <Activity size={36} style={{ color: auraColor }} className="animate-spin-slow" />
        ) : status === "speaking" ? (
          <Zap size={36} style={{ color: auraColor }} className="animate-bounce" />
        ) : status === "error" ? (
          <XCircle size={36} style={{ color: auraColor }} />
        ) : (
          <Mic size={36} style={{ color: auraColor }} />
        )}
      </div>

      {/* Status badge */}
      <div
        className={`absolute bottom-6 text-xs font-mono font-bold tracking-[0.25em] ${cfg.color} transition-colors duration-300`}
      >
        {cfg.label}
      </div>
    </div>
  );
}

// ── Console panel ─────────────────────────────────────────────────────────────
function SystemConsole({ logs, onClear }: { logs: ConsoleEntry[]; onClear: () => void }) {
  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/60">
        <div className="flex items-center gap-2 text-slate-300">
          <Terminal size={15} className="text-emerald-400" />
          <span className="text-xs font-mono font-semibold tracking-widest text-slate-300 uppercase">
            System Console
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400/70" />
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/70" />
          </div>
          <button
            onClick={onClear}
            className="text-[10px] font-mono text-slate-500 hover:text-slate-300 transition-colors"
          >
            clear
          </button>
        </div>
      </div>

      {/* Log body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-1 font-mono text-[11px] leading-relaxed scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
        {logs.map((entry) => {
          const style = LOG_STYLE[entry.type];
          return (
            <div key={entry.id} className="flex gap-2 group">
              <span className="text-slate-600 shrink-0 select-none">{entry.timestamp}</span>
              <span className={`shrink-0 w-11 ${style.color} font-bold`}>[{style.prefix}]</span>
              <span className={`${style.color} break-all`}>{entry.message}</span>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Blinking cursor */}
      <div className="px-4 py-2 border-t border-slate-700/40">
        <span className="font-mono text-[11px] text-emerald-400">
          aria@helpdesk:~$ <span className="animate-pulse">▋</span>
        </span>
      </div>
    </div>
  );
}

// ── Ticket row ────────────────────────────────────────────────────────────────
function TicketRow({ ticket, isNew }: { ticket: ReturnType<typeof useVoiceAgent>["tickets"][0]; isNew: boolean }) {
  return (
    <tr className={`border-b border-slate-800/50 transition-all duration-500 ${isNew ? "bg-emerald-500/5" : ""}`}>
      <td className="px-3 py-3">
        <span className="font-mono text-[11px] text-slate-400">{ticket.id}</span>
      </td>
      <td className="px-3 py-3">
        <div className="flex items-center gap-1.5 text-slate-300 text-xs">
          <span className="text-slate-500">{TICKET_TYPE_ICON[ticket.type]}</span>
          {ticket.employeeName}
        </div>
      </td>
      <td className="px-3 py-3">
        <span className="text-slate-400 text-[11px] leading-snug">{ticket.summary}</span>
      </td>
      <td className="px-3 py-3">
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide ${TICKET_STATUS_STYLE[ticket.status]}`}>
          {ticket.status.replace("_", " ")}
        </span>
      </td>
    </tr>
  );
}

// ── Stats bar ─────────────────────────────────────────────────────────────────
function StatBadge({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800/60 border border-slate-700/50`}>
      <span className={color}>{icon}</span>
      <div>
        <div className={`text-lg font-bold font-mono leading-none ${color}`}>{value}</div>
        <div className="text-[10px] text-slate-500 uppercase tracking-wide">{label}</div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function Page() {
  const { status, consoleLog, tickets, transcript, lastResponse, startSession, stopSession, clearLogs, isActive } =
    useVoiceAgent();

  const [sessionActive, setSessionActive] = useState(false);
  const prevTicketCount = useRef(0);

  const handleToggleSession = () => {
    if (sessionActive) {
      stopSession();
      setSessionActive(false);
    } else {
      startSession();
      setSessionActive(true);
    }
  };

  const resolved = tickets.filter((t) => t.status === "resolved").length;
  const open = tickets.filter((t) => t.status === "open" || t.status === "in_progress").length;

  useEffect(() => {
    prevTicketCount.current = tickets.length;
  }, [tickets]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 overflow-hidden flex flex-col" style={{ fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace" }}>
      {/* Load fonts */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600;700&family=Syne:wght@400;600;700;800&display=swap');
        .font-display { font-family: 'Syne', sans-serif; }
        @keyframes spin-slow { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .animate-spin-slow { animation: spin-slow 3s linear infinite; }
        .scrollbar-thin::-webkit-scrollbar { width: 4px; }
        .scrollbar-thumb-slate-700::-webkit-scrollbar-thumb { background: #334155; border-radius: 2px; }
        .scrollbar-track-transparent::-webkit-scrollbar-track { background: transparent; }
      `}</style>

      {/* Top Nav ─────────────────────────────────────────────────────────────── */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-slate-800/70 bg-slate-950/80 backdrop-blur-sm z-20">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
            <ShieldCheck size={14} className="text-emerald-400" />
          </div>
          <div>
            <span className="font-display font-bold text-white text-base tracking-tight">ARIA</span>
            <span className="text-slate-500 text-xs ml-2 font-mono">Autonomous Resolution & IT Agent</span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 text-xs font-mono">
            <span className={`w-1.5 h-1.5 rounded-full ${sessionActive ? "bg-emerald-400 animate-pulse" : "bg-slate-600"}`} />
            <span className={sessionActive ? "text-emerald-400" : "text-slate-500"}>
              {sessionActive ? "LIVE" : "OFFLINE"}
            </span>
          </div>
          <span className="text-slate-600 text-xs font-mono">v2.4.1</span>
        </div>
      </header>

      {/* Body ─────────────────────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* LEFT — System Console ──────────────────────────────────────────────── */}
        <aside className="w-[380px] border-r border-slate-800/70 bg-slate-950 flex flex-col overflow-hidden shrink-0">
          <SystemConsole logs={consoleLog} onClear={clearLogs} />
        </aside>

        {/* CENTER — Voice Aura + Controls ─────────────────────────────────────── */}
        <main className="flex-1 flex flex-col items-center justify-center gap-8 relative px-8">
          {/* Grid bg */}
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: "linear-gradient(#94a3b8 1px, transparent 1px), linear-gradient(90deg, #94a3b8 1px, transparent 1px)",
              backgroundSize: "32px 32px",
            }}
          />

          {/* Aura */}
          <VoiceAura status={status} />

          {/* Last transcript */}
          {transcript && (
            <div className="max-w-md text-center">
              <p className="text-slate-500 text-xs font-mono mb-1">You said:</p>
              <p className="text-slate-300 text-sm font-mono px-4 py-2 bg-slate-800/50 rounded-lg border border-slate-700/40">
                "{transcript}"
              </p>
            </div>
          )}

          {/* Last response */}
          {lastResponse && (
            <div className="max-w-md text-center">
              <p className="text-sky-500 text-xs font-mono mb-1">ARIA said:</p>
              <p className="text-slate-300 text-sm font-mono px-4 py-2 bg-sky-500/5 rounded-lg border border-sky-500/20">
                "{lastResponse}"
              </p>
            </div>
          )}

          {/* Main CTA ──────────────────────────────────────────────── */}
          <button
            onClick={handleToggleSession}
            className={`relative group flex items-center gap-3 px-8 py-4 rounded-xl font-display font-semibold text-sm transition-all duration-300 ${
              sessionActive
                ? "bg-red-500/10 border border-red-500/40 text-red-400 hover:bg-red-500/20"
                : "bg-emerald-500/10 border border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/20"
            }`}
          >
            {sessionActive ? (
              <>
                <MicOff size={18} />
                End IT Support Session
              </>
            ) : (
              <>
                <Mic size={18} />
                Start IT Support Session
              </>
            )}
          </button>

          {/* Stats ──────────────────────────────────────────────────── */}
          <div className="flex gap-3">
            <StatBadge icon={<CheckCircle2 size={14} />} label="Resolved" value={resolved} color="text-emerald-400" />
            <StatBadge icon={<Clock size={14} />} label="Open" value={open} color="text-amber-400" />
            <StatBadge icon={<Ticket size={14} />} label="Total" value={tickets.length} color="text-sky-400" />
          </div>

          {/* Quick-start hints */}
          {!sessionActive && (
            <div className="max-w-sm text-center space-y-1.5">
              <p className="text-slate-600 text-[11px] font-mono uppercase tracking-widest mb-3">Try saying:</p>
              {[
                "My account is locked, employee ID EMP001",
                "I can't connect to VPN, I'm employee EMP002",
                "I need a Figma license, I'm EMP003",
              ].map((hint, i) => (
                <div key={i} className="flex items-center gap-2 text-slate-500 text-[11px] font-mono">
                  <ChevronRight size={10} className="text-emerald-600 shrink-0" />
                  <span>"{hint}"</span>
                </div>
              ))}
            </div>
          )}
        </main>

        {/* RIGHT — Live IT Tickets ─────────────────────────────────────────────── */}
        <aside className="w-[420px] border-l border-slate-800/70 bg-slate-950 flex flex-col overflow-hidden shrink-0">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/60">
            <div className="flex items-center gap-2">
              <Ticket size={14} className="text-sky-400" />
              <span className="text-xs font-mono font-semibold tracking-widest text-slate-300 uppercase">
                Live IT Tickets
              </span>
            </div>
            <span className="text-[10px] font-mono text-slate-500 bg-slate-800/60 px-2 py-0.5 rounded">
              {tickets.length} total
            </span>
          </div>

          <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
            {tickets.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-600 gap-3">
                <Ticket size={28} className="opacity-30" />
                <p className="text-xs font-mono">No tickets yet</p>
                <p className="text-[10px] font-mono text-slate-700">Start a session to begin</p>
              </div>
            ) : (
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-800">
                    <th className="px-3 py-2 text-[10px] font-mono text-slate-600 uppercase tracking-wider">ID</th>
                    <th className="px-3 py-2 text-[10px] font-mono text-slate-600 uppercase tracking-wider">Employee</th>
                    <th className="px-3 py-2 text-[10px] font-mono text-slate-600 uppercase tracking-wider">Summary</th>
                    <th className="px-3 py-2 text-[10px] font-mono text-slate-600 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {[...tickets].reverse().map((ticket, i) => (
                    <TicketRow key={ticket.id} ticket={ticket} isNew={i === 0 && tickets.length > prevTicketCount.current} />
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Footer legend */}
          <div className="px-4 py-3 border-t border-slate-800/60 flex items-center gap-4">
            {[
              { icon: <Shield size={10} />, label: "Account", color: "text-violet-400" },
              { icon: <WifiOff size={10} />, label: "VPN", color: "text-amber-400" },
              { icon: <Package size={10} />, label: "Software", color: "text-sky-400" },
            ].map((item) => (
              <div key={item.label} className={`flex items-center gap-1 text-[10px] font-mono ${item.color}`}>
                {item.icon}
                {item.label}
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}
