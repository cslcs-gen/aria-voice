"use client";

// app/page.tsx — ARIA wrapped in Figma Health Portal UI shell

import { useEffect, useRef, useState } from "react";
import {
  Mic, MicOff, Terminal, Shield, ShieldCheck,
  Package, Wifi, WifiOff, User, CheckCircle2,
  Clock, AlertCircle, Activity, Zap, Radio,
  ChevronRight, ArrowRight, FileText, Search,
  MessageSquare, Menu, X, TrendingUp,
} from "lucide-react";
import { useVoiceAgent, type ConsoleEntry, type AgentStatus } from "@/hooks/useVoiceAgent";

// ── Types ─────────────────────────────────────────────────────────────────────
type Tab = "assistant" | "console" | "tickets";
type NavPage = "home" | "assistant" | "track";

// ── Status config ─────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<AgentStatus, {
  label: string; textColor: string; bgColor: string;
  borderColor: string; glowColor: string; pulse: boolean;
}> = {
  idle:      { label: "Ready",      textColor: "text-slate-500",   bgColor: "bg-slate-100",   borderColor: "border-slate-300",   glowColor: "#94a3b8", pulse: false },
  listening: { label: "Listening",  textColor: "text-emerald-700", bgColor: "bg-emerald-50",  borderColor: "border-emerald-400", glowColor: "#10b981", pulse: true  },
  thinking:  { label: "Thinking",   textColor: "text-amber-700",   bgColor: "bg-amber-50",    borderColor: "border-amber-400",   glowColor: "#f59e0b", pulse: true  },
  speaking:  { label: "Speaking",   textColor: "text-blue-700",    bgColor: "bg-blue-50",     borderColor: "border-blue-400",    glowColor: "#3b82f6", pulse: true  },
  error:     { label: "Error",      textColor: "text-red-700",     bgColor: "bg-red-50",      borderColor: "border-red-400",     glowColor: "#ef4444", pulse: false },
};

const LOG_STYLE: Record<ConsoleEntry["type"], { prefix: string; color: string }> = {
  system: { prefix: "SYS",   color: "text-slate-500"   },
  think:  { prefix: "THINK", color: "text-amber-600"   },
  action: { prefix: "EXEC",  color: "text-violet-600"  },
  result: { prefix: "RES",   color: "text-emerald-600" },
  speak:  { prefix: "ARIA",  color: "text-blue-600"    },
  listen: { prefix: "USER",  color: "text-teal-600"    },
  error:  { prefix: "ERR",   color: "text-red-600"     },
};

const TICKET_TYPE_ICON: Record<string, React.ReactNode> = {
  account_lockout:  <Shield size={12} className="text-violet-500" />,
  vpn_issue:        <Wifi size={12} className="text-amber-500" />,
  software_request: <Package size={12} className="text-blue-500" />,
  general:          <User size={12} className="text-slate-500" />,
};

const TICKET_STATUS_STYLE: Record<string, string> = {
  open:        "bg-amber-50 text-amber-700 border border-amber-200",
  in_progress: "bg-blue-50 text-blue-700 border border-blue-200",
  resolved:    "bg-green-50 text-green-700 border border-green-200",
};

// ── Voice Aura ────────────────────────────────────────────────────────────────
function VoiceAura({ status }: { status: AgentStatus }) {
  const cfg = STATUS_CONFIG[status];
  const rings = [180, 140, 100];

  return (
    <div className="relative flex items-center justify-center" style={{ width: 220, height: 220 }}>
      {rings.map((r, i) => (
        <div
          key={i}
          className="absolute rounded-full border-2 transition-all duration-700"
          style={{
            width: r, height: r,
            borderColor: cfg.glowColor,
            opacity: cfg.pulse ? 0.12 + i * 0.06 : 0.05,
            animation: cfg.pulse ? `ping ${1.6 + i * 0.3}s cubic-bezier(0,0,0.2,1) infinite` : "none",
            animationDelay: `${i * 200}ms`,
          }}
        />
      ))}

      {/* Core */}
      <div
        className={`relative z-10 w-24 h-24 rounded-full flex flex-col items-center justify-center border-2 ${cfg.borderColor} ${cfg.bgColor} shadow-lg transition-all duration-500`}
        style={{ boxShadow: cfg.pulse ? `0 0 32px 4px ${cfg.glowColor}33` : "none" }}
      >
        {status === "listening" ? <Radio size={28} className={cfg.textColor + " animate-pulse"} />
        : status === "thinking"  ? <Activity size={28} className={cfg.textColor + " animate-spin-slow"} />
        : status === "speaking"  ? <Zap size={28} className={cfg.textColor + " animate-bounce"} />
        : status === "error"     ? <AlertCircle size={28} className={cfg.textColor} />
        : <Mic size={28} className={cfg.textColor} />}
      </div>

      {/* Status pill */}
      <div className={`absolute -bottom-3 px-3 py-1 rounded-full text-xs font-semibold border ${cfg.bgColor} ${cfg.textColor} ${cfg.borderColor} shadow-sm`}>
        {cfg.label}
      </div>
    </div>
  );
}

// ── Navigation ────────────────────────────────────────────────────────────────
function Navigation({ page, onNav }: { page: NavPage; onNav: (p: NavPage) => void }) {
  const [open, setOpen] = useState(false);
  const navItems: { id: NavPage; label: string }[] = [
    { id: "home", label: "Home" },
    { id: "assistant", label: "IT Assistant" },
    { id: "track", label: "Track Tickets" },
  ];

  return (
    <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-slate-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <button onClick={() => onNav("home")} className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-blue-800 flex items-center justify-center shadow">
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            <div className="text-left">
              <p className="font-semibold text-slate-900 text-sm leading-none">ARIA</p>
              <p className="text-xs text-slate-500 leading-none mt-0.5">IT Support Portal</p>
            </div>
          </button>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-6">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => onNav(item.id)}
                className={`text-sm transition-colors ${
                  page === item.id ? "text-blue-800 font-semibold" : "text-slate-500 hover:text-slate-900"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* Mobile hamburger */}
          <button className="md:hidden p-2 rounded-lg hover:bg-slate-100" onClick={() => setOpen(!open)}>
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden border-t border-slate-200 bg-white">
          <div className="px-4 py-3 space-y-1">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => { onNav(item.id); setOpen(false); }}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                  page === item.id ? "bg-blue-50 text-blue-800 font-semibold" : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </nav>
  );
}

// ── Console ───────────────────────────────────────────────────────────────────
function ConsolePanel({ logs, onClear }: { logs: ConsoleEntry[]; onClear: () => void }) {
  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [logs]);

  return (
    <div className="flex flex-col h-full bg-slate-950 rounded-xl overflow-hidden border border-slate-200 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-900 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <Terminal size={13} className="text-emerald-400" />
          <span className="text-xs font-mono font-semibold tracking-widest text-slate-300 uppercase">System Console</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400/80" />
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
          </div>
          <button onClick={onClear} className="text-[10px] font-mono text-slate-500 hover:text-slate-300">clear</button>
        </div>
      </div>

      {/* Logs */}
      <div className="flex-1 overflow-y-auto p-4 space-y-0.5 font-mono text-[11px] scrollbar-thin scrollbar-thumb-slate scrollbar-track-transparent">
        {logs.map((entry) => {
          const s = LOG_STYLE[entry.type];
          return (
            <div key={entry.id} className="flex gap-2">
              <span className="text-slate-600 shrink-0 select-none hidden sm:inline">{entry.timestamp}</span>
              <span className={`shrink-0 w-11 ${s.color} font-bold`}>[{s.prefix}]</span>
              <span className={`${s.color} break-all leading-relaxed`}>{entry.message}</span>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div className="px-4 py-2 bg-slate-900 border-t border-slate-700">
        <span className="font-mono text-[11px] text-emerald-400">aria@helpdesk:~$ <span className="animate-pulse">▋</span></span>
      </div>
    </div>
  );
}

// ── Ticket Card ───────────────────────────────────────────────────────────────
function TicketCard({ ticket }: { ticket: ReturnType<typeof useVoiceAgent>["tickets"][0] }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2">
          {TICKET_TYPE_ICON[ticket.type]}
          <span className="font-semibold text-slate-800 text-sm">{ticket.employeeName}</span>
        </div>
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide ${TICKET_STATUS_STYLE[ticket.status]}`}>
          {ticket.status.replace("_", " ")}
        </span>
      </div>
      <p className="text-slate-500 text-xs mb-2">{ticket.summary}</p>
      <div className="flex items-center justify-between text-[10px] text-slate-400">
        <span className="font-mono">{ticket.id}</span>
        <span>{new Date(ticket.createdAt).toLocaleTimeString()}</span>
      </div>
    </div>
  );
}

// ── Home Page ─────────────────────────────────────────────────────────────────
function HomePage({ onNav }: { onNav: (p: NavPage) => void }) {
  const stats = [
    { icon: <Shield className="w-4 h-4" />, value: "15,432", label: "Cases Resolved", change: "+12% this month" },
    { icon: <CheckCircle2 className="w-4 h-4" />, value: "24/7",   label: "Support Available", change: "Always here for you" },
    { icon: <Clock className="w-4 h-4" />,   value: "< 2min",  label: "Avg Resolution",   change: "AI-powered speed" },
  ];

  const quickActions = [
    { icon: MessageSquare, title: "IT Voice Assistant",  desc: "Talk to ARIA — unlock accounts, fix VPN, request software",  page: "assistant" as NavPage, color: "text-blue-600",   bg: "bg-blue-50"   },
    { icon: Search,        title: "Track IT Tickets",    desc: "Monitor the real-time status of your resolved IT requests",  page: "track" as NavPage,     color: "text-green-600", bg: "bg-green-50"  },
    { icon: FileText,      title: "How ARIA Works",      desc: "Learn about the 3 supported IT scenarios and how to use them", page: "assistant" as NavPage, color: "text-violet-600", bg: "bg-violet-50" },
  ];

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="bg-gradient-to-b from-blue-50 to-white py-16 md:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left */}
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-100 text-blue-800 border border-blue-200 text-sm font-medium">
                <ShieldCheck className="w-4 h-4" />
                Adaptive Resolution & Intelligence Agent
              </div>

              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight text-slate-900">
                Your IT Issues,<br />
                <span className="text-blue-800">Resolved Instantly</span>
              </h1>

              <p className="text-lg text-slate-500 max-w-xl">
                ARIA is an AI-powered voice IT support agent. Speak naturally to unlock accounts,
                fix VPN connections, and provision software — all in seconds.
              </p>

              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => onNav("assistant")}
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-blue-800 text-white rounded-lg font-semibold text-sm hover:bg-blue-900 transition-colors shadow"
                >
                  Start IT Support Session
                  <ArrowRight className="w-4 h-4" />
                </button>
                <button
                  onClick={() => onNav("track")}
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-white text-slate-700 rounded-lg font-semibold text-sm border border-slate-200 hover:bg-slate-50 transition-colors shadow-sm"
                >
                  Track My Tickets
                </button>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-4 pt-6 border-t border-slate-200">
                {stats.map((s, i) => (
                  <div key={i} className="space-y-1">
                    <div className="text-slate-400">{s.icon}</div>
                    <p className="text-2xl font-bold text-slate-900">{s.value}</p>
                    <p className="text-xs text-slate-500">{s.label}</p>
                    <p className="text-xs text-emerald-600 font-medium">{s.change}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Right — Mini ARIA preview card */}
            <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-6 space-y-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-blue-700" />
                  <span className="font-semibold text-slate-800">ARIA Voice Assistant</span>
                </div>
                <span className="flex items-center gap-1.5 text-xs text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-full font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Online
                </span>
              </div>

              <div className="flex justify-center py-4">
                <VoiceAura status="idle" />
              </div>

              <div className="space-y-2">
                <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">Supported scenarios</p>
                {[
                  { icon: <Shield size={14} className="text-violet-500" />,  label: "Account Lockout & Password Reset" },
                  { icon: <WifiOff size={14} className="text-amber-500" />,  label: "VPN Certificate Repair" },
                  { icon: <Package size={14} className="text-blue-500" />,   label: "Software License Provisioning" },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm text-slate-600">
                    {item.icon}
                    {item.label}
                  </div>
                ))}
              </div>

              <button
                onClick={() => onNav("assistant")}
                className="w-full flex items-center justify-center gap-2 py-3 bg-blue-800 text-white rounded-lg font-semibold text-sm hover:bg-blue-900 transition-colors"
              >
                <Mic className="w-4 h-4" />
                Launch ARIA
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Quick Actions */}
      <section className="py-16 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold text-slate-900 mb-3">How Can We Help You Today?</h2>
            <p className="text-slate-500 max-w-xl mx-auto text-sm">
              Choose from ARIA&apos;s capabilities — all powered by AI with autonomous tool execution
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-5">
            {quickActions.map((a, i) => (
              <button
                key={i}
                onClick={() => onNav(a.page)}
                className="group text-left bg-white border border-slate-200 rounded-xl p-6 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
              >
                <div className={`w-11 h-11 rounded-lg ${a.bg} flex items-center justify-center mb-4`}>
                  <a.icon className={`w-5 h-5 ${a.color}`} />
                </div>
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-slate-800 mb-1">{a.title}</h3>
                  <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-blue-700 group-hover:translate-x-0.5 transition-all shrink-0 mt-0.5" />
                </div>
                <p className="text-slate-500 text-sm">{a.desc}</p>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Footer CTA */}
      <section className="py-16 bg-blue-800 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-5">
          <h2 className="text-3xl font-bold">Ready to Experience Autonomous IT Support?</h2>
          <p className="text-blue-200 max-w-xl mx-auto text-sm">
            ARIA resolves your IT issues end-to-end — no tickets, no waiting, no humans needed for routine problems.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => onNav("assistant")}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-white text-blue-800 rounded-lg font-semibold text-sm hover:bg-blue-50 transition-colors shadow"
            >
              <Mic className="w-4 h-4" />
              Start a Session Now
            </button>
            <button
              onClick={() => onNav("track")}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-transparent text-white rounded-lg font-semibold text-sm border border-white/40 hover:bg-white/10 transition-colors"
            >
              View My Tickets
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

// ── Assistant Page ────────────────────────────────────────────────────────────
function AssistantPage({
  status, consoleLog, tickets, transcript, lastResponse,
  sessionActive, onToggleSession, clearLogs,
}: {
  status: AgentStatus;
  consoleLog: ConsoleEntry[];
  tickets: ReturnType<typeof useVoiceAgent>["tickets"];
  transcript: string;
  lastResponse: string;
  sessionActive: boolean;
  onToggleSession: () => void;
  clearLogs: () => void;
}) {
  const [activeTab, setActiveTab] = useState<Tab>("assistant");

  const tabs: { id: Tab; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: "assistant", label: "Assistant", icon: <MessageSquare size={14} /> },
    { id: "console",   label: "Console",   icon: <Terminal size={14} />,      badge: consoleLog.length },
    { id: "tickets",   label: "Tickets",   icon: <FileText size={14} />,      badge: tickets.length   },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Page Header */}
      <div className="mb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-xs font-medium mb-3">
          <ShieldCheck className="w-3.5 h-3.5" />
          Adaptive Resolution & Intelligence Agent
        </div>
        <h1 className="text-2xl md:text-3xl font-bold text-slate-900">IT Voice Assistant</h1>
        <p className="text-slate-500 text-sm mt-1">Speak naturally to resolve IT issues — accounts, VPN, and software licensing</p>
      </div>

      {/* Desktop: 3-column layout */}
      <div className="hidden lg:grid lg:grid-cols-3 gap-6 h-[calc(100vh-280px)]">
        {/* Console */}
        <div className="flex flex-col">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <Terminal size={12} /> System Console
          </h2>
          <div className="flex-1 overflow-hidden">
            <ConsolePanel logs={consoleLog} onClear={clearLogs} />
          </div>
        </div>

        {/* Center — Voice Aura */}
        <div className="flex flex-col items-center justify-start pt-4 space-y-6">
          <VoiceAura status={status} />

          {transcript && (
            <div className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4">
              <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wide mb-1">You said</p>
              <p className="text-slate-700 text-sm">&ldquo;{transcript}&rdquo;</p>
            </div>
          )}

          {lastResponse && (
            <div className="w-full bg-blue-50 border border-blue-200 rounded-xl p-4">
              <p className="text-[10px] text-blue-400 font-medium uppercase tracking-wide mb-1">ARIA responded</p>
              <p className="text-blue-800 text-sm">&ldquo;{lastResponse}&rdquo;</p>
            </div>
          )}

          <button
            onClick={onToggleSession}
            className={`w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-semibold text-sm transition-all shadow ${
              sessionActive
                ? "bg-red-50 border border-red-200 text-red-700 hover:bg-red-100"
                : "bg-blue-800 text-white hover:bg-blue-900"
            }`}
          >
            {sessionActive ? <><MicOff size={16} /> End Session</> : <><Mic size={16} /> Start IT Support Session</>}
          </button>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-2 w-full">
            {[
              { icon: <CheckCircle2 size={13} className="text-emerald-500" />, label: "Resolved", value: tickets.filter(t => t.status === "resolved").length,  color: "text-emerald-700" },
              { icon: <Clock size={13} className="text-amber-500" />,          label: "Open",     value: tickets.filter(t => t.status !== "resolved").length,   color: "text-amber-700"  },
              { icon: <FileText size={13} className="text-blue-500" />,        label: "Total",    value: tickets.length,                                        color: "text-blue-700"   },
            ].map((s) => (
              <div key={s.label} className="bg-white border border-slate-200 rounded-xl p-3 text-center shadow-sm">
                <div className="flex justify-center mb-1">{s.icon}</div>
                <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
                <p className="text-[10px] text-slate-400 uppercase tracking-wide">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Hints */}
          {!sessionActive && (
            <div className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4">
              <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wide mb-2">Try saying:</p>
              {[
                "My account is locked, employee ID EMP001",
                "I can't connect to VPN, I'm EMP002",
                "I need a Figma license, I'm EMP003",
              ].map((hint, i) => (
                <div key={i} className="flex items-start gap-1.5 text-slate-600 text-xs mb-1">
                  <ChevronRight size={10} className="text-blue-500 shrink-0 mt-0.5" />
                  <span>&ldquo;{hint}&rdquo;</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right — Tickets */}
        <div className="flex flex-col">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <FileText size={12} /> Live IT Tickets
            {tickets.length > 0 && (
              <span className="ml-auto bg-blue-100 text-blue-700 text-[10px] font-semibold px-2 py-0.5 rounded-full">
                {tickets.length}
              </span>
            )}
          </h2>
          <div className="flex-1 overflow-y-auto space-y-3 scrollbar-thin scrollbar-thumb-slate scrollbar-track-transparent pr-1">
            {tickets.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                <FileText size={32} className="mb-3 opacity-30" />
                <p className="text-sm font-medium">No tickets yet</p>
                <p className="text-xs mt-1">Start a session to resolve IT issues</p>
              </div>
            ) : (
              [...tickets].reverse().map((t) => <TicketCard key={t.id} ticket={t} />)
            )}
          </div>
        </div>
      </div>

      {/* Mobile: Tab layout */}
      <div className="lg:hidden">
        {/* Tab bar */}
        <div className="flex border-b border-slate-200 mb-6">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-semibold border-b-2 transition-colors relative ${
                activeTab === tab.id
                  ? "border-blue-700 text-blue-800"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              {tab.icon}
              {tab.label}
              {tab.badge !== undefined && tab.badge > 0 && (
                <span className="bg-blue-700 text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                  {tab.badge > 99 ? "99+" : tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === "assistant" && (
          <div className="space-y-5">
            <div className="flex justify-center py-4">
              <VoiceAura status={status} />
            </div>

            {transcript && (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wide mb-1">You said</p>
                <p className="text-slate-700 text-sm">&ldquo;{transcript}&rdquo;</p>
              </div>
            )}

            {lastResponse && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <p className="text-[10px] text-blue-400 font-medium uppercase tracking-wide mb-1">ARIA responded</p>
                <p className="text-blue-800 text-sm">&ldquo;{lastResponse}&rdquo;</p>
              </div>
            )}

            <button
              onClick={onToggleSession}
              className={`w-full flex items-center justify-center gap-2 py-4 rounded-xl font-semibold text-sm transition-all ${
                sessionActive
                  ? "bg-red-50 border border-red-200 text-red-700"
                  : "bg-blue-800 text-white hover:bg-blue-900"
              }`}
            >
              {sessionActive ? <><MicOff size={16} /> End Session</> : <><Mic size={16} /> Start IT Support Session</>}
            </button>

            <div className="grid grid-cols-3 gap-3">
              {[
                { icon: <CheckCircle2 size={13} className="text-emerald-500" />, label: "Resolved", value: tickets.filter(t => t.status === "resolved").length, color: "text-emerald-700" },
                { icon: <Clock size={13} className="text-amber-500" />,          label: "Open",     value: tickets.filter(t => t.status !== "resolved").length, color: "text-amber-700"  },
                { icon: <FileText size={13} className="text-blue-500" />,        label: "Total",    value: tickets.length,                                      color: "text-blue-700"   },
              ].map((s) => (
                <div key={s.label} className="bg-white border border-slate-200 rounded-xl p-3 text-center shadow-sm">
                  <div className="flex justify-center mb-1">{s.icon}</div>
                  <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
                  <p className="text-[10px] text-slate-400 uppercase tracking-wide">{s.label}</p>
                </div>
              ))}
            </div>

            {!sessionActive && (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wide mb-2">Try saying:</p>
                {[
                  "My account is locked, employee ID EMP001",
                  "I can't connect to VPN, I'm EMP002",
                  "I need a Figma license, I'm EMP003",
                ].map((hint, i) => (
                  <div key={i} className="flex items-start gap-1.5 text-slate-600 text-xs mb-1">
                    <ChevronRight size={10} className="text-blue-500 shrink-0 mt-0.5" />
                    <span>&ldquo;{hint}&rdquo;</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "console" && (
          <div className="h-[500px]">
            <ConsolePanel logs={consoleLog} onClear={clearLogs} />
          </div>
        )}

        {activeTab === "tickets" && (
          <div className="space-y-3">
            {tickets.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                <FileText size={32} className="mb-3 opacity-30" />
                <p className="text-sm font-medium">No tickets yet</p>
                <p className="text-xs mt-1">Start a session to resolve IT issues</p>
              </div>
            ) : (
              [...tickets].reverse().map((t) => <TicketCard key={t.id} ticket={t} />)
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Track Page ────────────────────────────────────────────────────────────────
function TrackPage({ tickets }: { tickets: ReturnType<typeof useVoiceAgent>["tickets"] }) {
  const [search, setSearch] = useState("");
  const filtered = tickets.filter(
    (t) =>
      t.id.toLowerCase().includes(search.toLowerCase()) ||
      t.employeeName.toLowerCase().includes(search.toLowerCase()) ||
      t.summary.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-slate-900 mb-1">Track IT Tickets</h1>
        <p className="text-slate-500 text-sm">Monitor all IT support cases resolved by ARIA in this session</p>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Search by ticket ID, employee name, or summary..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: "Total",    value: tickets.length,                                       color: "text-blue-700",    bg: "bg-blue-50",    border: "border-blue-200"   },
          { label: "Resolved", value: tickets.filter(t => t.status === "resolved").length,  color: "text-green-700",   bg: "bg-green-50",   border: "border-green-200"  },
          { label: "Open",     value: tickets.filter(t => t.status !== "resolved").length,  color: "text-amber-700",   bg: "bg-amber-50",   border: "border-amber-200"  },
        ].map((s) => (
          <div key={s.label} className={`${s.bg} border ${s.border} rounded-xl p-4 text-center`}>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-slate-500 uppercase tracking-wide mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Ticket list */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
          <TrendingUp size={36} className="mb-3 opacity-30" />
          <p className="font-medium">{tickets.length === 0 ? "No tickets yet" : "No results found"}</p>
          <p className="text-sm mt-1">
            {tickets.length === 0
              ? "Go to IT Assistant and start a voice session"
              : "Try a different search term"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {[...filtered].reverse().map((t) => (
            <div key={t.id} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4 mb-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    {TICKET_TYPE_ICON[t.type]}
                    <span className="font-semibold text-slate-800">{t.employeeName}</span>
                    <span className="font-mono text-xs text-slate-400">{t.id}</span>
                  </div>
                  <p className="text-slate-600 text-sm">{t.summary}</p>
                </div>
                <span className={`shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full uppercase tracking-wide ${TICKET_STATUS_STYLE[t.status]}`}>
                  {t.status.replace("_", " ")}
                </span>
              </div>

              {t.actions.length > 0 && (
                <div className="border-t border-slate-100 pt-3">
                  <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wide mb-2">Actions taken</p>
                  <div className="space-y-1">
                    {t.actions.map((a, i) => (
                      <div key={i} className="flex items-start gap-1.5 text-xs text-slate-500">
                        <CheckCircle2 size={10} className="text-emerald-500 shrink-0 mt-0.5" />
                        {a}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between mt-3 text-[10px] text-slate-400">
                <span>Created {new Date(t.createdAt).toLocaleString()}</span>
                {t.resolvedAt && <span>Resolved {new Date(t.resolvedAt).toLocaleString()}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function Page() {
  const {
    status, consoleLog, tickets, transcript, lastResponse,
    startSession, stopSession, clearLogs,
  } = useVoiceAgent();

  const [sessionActive, setSessionActive] = useState(false);
  const [page, setPage] = useState<NavPage>("home");

  const handleToggleSession = () => {
    if (sessionActive) { stopSession(); setSessionActive(false); }
    else { startSession(); setSessionActive(true); }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        body { font-family: 'Inter', sans-serif; }
        @keyframes spin-slow { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        .animate-spin-slow { animation: spin-slow 3s linear infinite; }
        .scrollbar-thin::-webkit-scrollbar { width: 4px; }
        .scrollbar-thumb-slate::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 2px; }
        .scrollbar-track-transparent::-webkit-scrollbar-track { background: transparent; }
      `}</style>

      <div className="min-h-screen bg-slate-50">
        <Navigation page={page} onNav={setPage} />

        {page === "home" && <HomePage onNav={setPage} />}

        {page === "assistant" && (
          <AssistantPage
            status={status}
            consoleLog={consoleLog}
            tickets={tickets}
            transcript={transcript}
            lastResponse={lastResponse}
            sessionActive={sessionActive}
            onToggleSession={handleToggleSession}
            clearLogs={clearLogs}
          />
        )}

        {page === "track" && <TrackPage tickets={tickets} />}
      </div>
    </>
  );
}
