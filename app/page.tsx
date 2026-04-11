"use client";
// app/page.tsx — ARIA Singapore Vaping Public Health Portal

import { useRef, useState } from "react";
import {
  Mic, MicOff, Terminal, ShieldCheck, Search,
  MessageSquare, Menu, X, ArrowRight, FileText,
  CheckCircle2, Clock, AlertCircle, Activity,
  Zap, Radio, ChevronRight, Phone, Mail,
  Calendar, User, TrendingUp, Shield,
} from "lucide-react";
import { useVoiceAgent, type ConsoleEntry, type AgentStatus, type VapingCase } from "@/hooks/useVoiceAgent";

type NavPage = "home" | "assistant" | "track";

// ── Status config ─────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<AgentStatus, {
  label: string; textColor: string; bgColor: string;
  borderColor: string; glowColor: string; pulse: boolean;
}> = {
  idle:      { label: "Ready",      textColor: "text-slate-500",   bgColor: "bg-slate-100",  borderColor: "border-slate-300",   glowColor: "#94a3b8", pulse: false },
  listening: { label: "Listening",  textColor: "text-emerald-700", bgColor: "bg-emerald-50", borderColor: "border-emerald-400", glowColor: "#10b981", pulse: true  },
  thinking:  { label: "Thinking",   textColor: "text-amber-700",   bgColor: "bg-amber-50",   borderColor: "border-amber-400",   glowColor: "#f59e0b", pulse: true  },
  speaking:  { label: "Speaking",   textColor: "text-blue-700",    bgColor: "bg-blue-50",    borderColor: "border-blue-400",    glowColor: "#3b82f6", pulse: true  },
  error:     { label: "Error",      textColor: "text-red-700",     bgColor: "bg-red-50",     borderColor: "border-red-400",     glowColor: "#ef4444", pulse: false },
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

const CASE_STATUS_STYLE: Record<string, string> = {
  open:        "bg-amber-50 text-amber-700 border border-amber-200",
  in_progress: "bg-blue-50 text-blue-700 border border-blue-200",
  resolved:    "bg-green-50 text-green-700 border border-green-200",
};

// ── Voice Aura ────────────────────────────────────────────────────────────────
function VoiceAura({ status }: { status: AgentStatus }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <div className="relative flex items-center justify-center" style={{ width: 220, height: 220 }}>
      {[180, 140, 100].map((r, i) => (
        <div key={i} className="absolute rounded-full border-2 transition-all duration-700"
          style={{
            width: r, height: r, borderColor: cfg.glowColor,
            opacity: cfg.pulse ? 0.1 + i * 0.06 : 0.04,
            animation: cfg.pulse ? `ping ${1.6 + i * 0.3}s cubic-bezier(0,0,0.2,1) infinite` : "none",
            animationDelay: `${i * 200}ms`,
          }}
        />
      ))}
      <div
        className={`relative z-10 w-24 h-24 rounded-full flex items-center justify-center border-2 ${cfg.borderColor} ${cfg.bgColor} shadow-lg transition-all duration-500`}
        style={{ boxShadow: cfg.pulse ? `0 0 32px 4px ${cfg.glowColor}33` : "none" }}
      >
        {status === "listening" ? <Radio size={30} className={cfg.textColor + " animate-pulse"} />
        : status === "thinking"  ? <Activity size={30} className={cfg.textColor + " animate-spin-slow"} />
        : status === "speaking"  ? <Zap size={30} className={cfg.textColor + " animate-bounce"} />
        : status === "error"     ? <AlertCircle size={30} className={cfg.textColor} />
        : <Mic size={30} className={cfg.textColor} />}
      </div>
      <div className={`absolute -bottom-4 px-3 py-1 rounded-full text-xs font-semibold border shadow-sm ${cfg.bgColor} ${cfg.textColor} ${cfg.borderColor}`}>
        {cfg.label}
      </div>
    </div>
  );
}

// ── Navigation ────────────────────────────────────────────────────────────────
function Navigation({ page, onNav }: { page: NavPage; onNav: (p: NavPage) => void }) {
  const [open, setOpen] = useState(false);
  const items: { id: NavPage; label: string }[] = [
    { id: "home",      label: "Home"            },
    { id: "assistant", label: "Voice Assistant" },
    { id: "track",     label: "Track Cases"     },
  ];
  return (
    <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-slate-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <button onClick={() => onNav("home")} className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-blue-800 flex items-center justify-center shadow">
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            <div className="text-left">
              <p className="font-semibold text-slate-900 text-sm leading-none">ARIA</p>
              <p className="text-[10px] text-slate-500 leading-none mt-0.5">Vaping Enforcement Portal</p>
            </div>
          </button>
          <div className="hidden md:flex items-center gap-6">
            {items.map((item) => (
              <button key={item.id} onClick={() => onNav(item.id)}
                className={`text-sm transition-colors ${page === item.id ? "text-blue-800 font-semibold" : "text-slate-500 hover:text-slate-900"}`}>
                {item.label}
              </button>
            ))}
          </div>
          <button className="md:hidden p-2 rounded-lg hover:bg-slate-100" onClick={() => setOpen(!open)}>
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>
      {open && (
        <div className="md:hidden border-t border-slate-200 bg-white">
          <div className="px-4 py-3 space-y-1">
            {items.map((item) => (
              <button key={item.id} onClick={() => { onNav(item.id); setOpen(false); }}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${page === item.id ? "bg-blue-50 text-blue-800 font-semibold" : "text-slate-600 hover:bg-slate-50"}`}>
                {item.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </nav>
  );
}

// ── Console Panel ─────────────────────────────────────────────────────────────
function ConsolePanel({ logs, onClear }: { logs: ConsoleEntry[]; onClear: () => void }) {
  const bottomRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const scroll = () => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); };
  if (typeof window !== "undefined") setTimeout(scroll, 50);

  return (
    <div className="flex flex-col h-full bg-slate-950 rounded-xl overflow-hidden border border-slate-200 shadow-sm">
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
      <div className="flex-1 overflow-y-auto p-4 space-y-0.5 font-mono text-[11px] scrollbar-thin scrollbar-thumb-slate scrollbar-track-transparent">
        {logs.map((entry) => {
          const s = LOG_STYLE[entry.type];
          return (
            <div key={entry.id} className="flex gap-2">
              <span className="text-slate-600 shrink-0 hidden sm:inline">{entry.timestamp}</span>
              <span className={`shrink-0 w-11 ${s.color} font-bold`}>[{s.prefix}]</span>
              <span className={`${s.color} break-all leading-relaxed`}>{entry.message}</span>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
      <div className="px-4 py-2 bg-slate-900 border-t border-slate-700">
        <span className="font-mono text-[11px] text-emerald-400">aria@vaping-helpline:~$ <span className="animate-pulse">▋</span></span>
      </div>
    </div>
  );
}

// ── Case Card ─────────────────────────────────────────────────────────────────
function CaseCard({ c }: { c: VapingCase }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <User size={13} className="text-slate-400" />
            <span className="font-semibold text-slate-800 text-sm">{c.name}</span>
          </div>
          <span className="font-mono text-[10px] text-slate-400">{c.id}</span>
        </div>
        <span className={`shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide ${CASE_STATUS_STYLE[c.status]}`}>
          {c.status.replace("_", " ")}
        </span>
      </div>
      <p className="text-slate-600 text-xs mb-3">{c.query}</p>
      <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-400">
        <div className="flex items-center gap-1"><Phone size={9} />{c.contact}</div>
        {c.email && <div className="flex items-center gap-1"><Mail size={9} />{c.email}</div>}
        {c.callbackTime && <div className="flex items-center gap-1"><Calendar size={9} />{c.callbackTime}</div>}
        <div className="flex items-center gap-1"><Clock size={9} />{new Date(c.createdAt).toLocaleString()}</div>
      </div>
    </div>
  );
}

// ── Home Page ─────────────────────────────────────────────────────────────────
function HomePage({ onNav }: { onNav: (p: NavPage) => void }) {
  const topics = [
    { icon: Shield,       title: "Laws & Penalties",     desc: "Singapore vaping regulations, fines up to SGD 10,000 and imprisonment",       color: "text-blue-600",    bg: "bg-blue-50"    },
    { icon: Activity,     title: "Health Effects",        desc: "Short and long-term risks of vaping including EVALI and nicotine addiction",    color: "text-red-600",     bg: "bg-red-50"     },
    { icon: Search,       title: "How to Report",         desc: "Report vaping violations to HSA, NEA or SPF with step-by-step guidance",        color: "text-green-600",   bg: "bg-green-50"   },
    { icon: FileText,     title: "Business Regulations",  desc: "Compliance requirements for retail, F&B, hotels and workplaces",                color: "text-violet-600",  bg: "bg-violet-50"  },
    { icon: MessageSquare,title: "Voice Assistant",       desc: "Speak to ARIA in natural language for instant answers to any vaping question",  color: "text-amber-600",   bg: "bg-amber-50"   },
    { icon: Phone,        title: "Request Callback",      desc: "Can't find your answer? Log a case and an officer will call you back",          color: "text-teal-600",    bg: "bg-teal-50"    },
  ];

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="bg-gradient-to-b from-blue-50 to-white py-16 md:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-100 text-blue-800 border border-blue-200 text-sm font-medium">
                <ShieldCheck className="w-4 h-4" />
                Singapore Vaping Enforcement & Education
              </div>
              <h1 className="text-4xl md:text-5xl font-bold leading-tight text-slate-900">
                Your Questions,<br />
                <span className="text-blue-800">Answered Instantly</span>
              </h1>
              <p className="text-lg text-slate-500 max-w-xl">
                ARIA is Singapore&apos;s AI-powered vaping information assistant. Ask about laws, health effects,
                reporting violations — or request an officer callback if needed.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <button onClick={() => onNav("assistant")}
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-blue-800 text-white rounded-lg font-semibold text-sm hover:bg-blue-900 transition-colors shadow">
                  Talk to ARIA <ArrowRight className="w-4 h-4" />
                </button>
                <button onClick={() => onNav("track")}
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-white text-slate-700 rounded-lg font-semibold text-sm border border-slate-200 hover:bg-slate-50 transition-colors shadow-sm">
                  Track My Case
                </button>
              </div>
              {/* Quick stats */}
              <div className="grid grid-cols-3 gap-4 pt-4 border-t border-slate-200">
                {[
                  { value: "24/7",      label: "Support Available",    note: "Always online"         },
                  { value: "SGD 10K",   label: "Max Import Penalty",   note: "Know the risks"        },
                  { value: "< 2 min",   label: "Avg Answer Time",      note: "AI-powered speed"      },
                ].map((s, i) => (
                  <div key={i} className="space-y-0.5">
                    <p className="text-xl font-bold text-slate-900">{s.value}</p>
                    <p className="text-xs text-slate-500">{s.label}</p>
                    <p className="text-xs text-emerald-600 font-medium">{s.note}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Preview card */}
            <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-6 space-y-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-blue-700" />
                  <span className="font-semibold text-slate-800">ARIA Voice Assistant</span>
                </div>
                <span className="flex items-center gap-1.5 text-xs text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-full font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />Online
                </span>
              </div>
              <div className="flex justify-center py-2"><VoiceAura status="idle" /></div>
              <div className="space-y-2">
                <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wide">Try asking ARIA:</p>
                {[
                  "What are the penalties for vaping in Singapore?",
                  "Is it illegal to bring a vape device into Singapore?",
                  "How do I report someone selling vapes?",
                  "What are the health risks of vaping?",
                ].map((q, i) => (
                  <div key={i} className="flex items-start gap-1.5 text-slate-600 text-xs">
                    <ChevronRight size={10} className="text-blue-500 shrink-0 mt-0.5" />
                    <span>&ldquo;{q}&rdquo;</span>
                  </div>
                ))}
              </div>
              <button onClick={() => onNav("assistant")}
                className="w-full flex items-center justify-center gap-2 py-3 bg-blue-800 text-white rounded-lg font-semibold text-sm hover:bg-blue-900 transition-colors">
                <Mic className="w-4 h-4" /> Start Voice Session
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Topics grid */}
      <section className="py-16 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold text-slate-900 mb-3">What Can ARIA Help With?</h2>
            <p className="text-slate-500 text-sm max-w-xl mx-auto">
              From Singapore vaping laws to health effects and reporting — ARIA has you covered
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {topics.map((t, i) => (
              <button key={i} onClick={() => onNav("assistant")}
                className="group text-left bg-white border border-slate-200 rounded-xl p-6 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
                <div className={`w-11 h-11 rounded-lg ${t.bg} flex items-center justify-center mb-4`}>
                  <t.icon className={`w-5 h-5 ${t.color}`} />
                </div>
                <div className="flex items-start justify-between gap-2 mb-1">
                  <h3 className="font-semibold text-slate-800">{t.title}</h3>
                  <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-blue-700 group-hover:translate-x-0.5 transition-all shrink-0 mt-0.5" />
                </div>
                <p className="text-slate-500 text-sm">{t.desc}</p>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Important notice */}
      <section className="py-10 bg-amber-50 border-y border-amber-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-900">Important: Vaping is Illegal in Singapore</p>
              <p className="text-amber-700 text-sm mt-0.5">
                Possession, use, importation and sale of vaping devices carries fines up to SGD 10,000 and imprisonment.
              </p>
            </div>
          </div>
          <a href="https://www.hsa.gov.sg" target="_blank" rel="noopener noreferrer"
            className="shrink-0 inline-flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-semibold hover:bg-amber-700 transition-colors">
            Visit HSA <ArrowRight className="w-4 h-4" />
          </a>
        </div>
      </section>

      {/* Footer CTA */}
      <section className="py-16 bg-blue-800 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-5">
          <h2 className="text-3xl font-bold">Have a Question About Vaping?</h2>
          <p className="text-blue-200 text-sm max-w-xl mx-auto">
            ARIA can answer your questions instantly — and if we can&apos;t, we&apos;ll log a case for an officer to call you back.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button onClick={() => onNav("assistant")}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-white text-blue-800 rounded-lg font-semibold text-sm hover:bg-blue-50 transition-colors shadow">
              <Mic className="w-4 h-4" /> Ask ARIA Now
            </button>
            <button onClick={() => onNav("track")}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-transparent text-white rounded-lg font-semibold text-sm border border-white/40 hover:bg-white/10 transition-colors">
              Track My Case
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

// ── Assistant Page ────────────────────────────────────────────────────────────
function AssistantPage({
  status, consoleLog, cases, transcript, lastResponse,
  sessionActive, onToggleSession, clearLogs,
}: {
  status: AgentStatus;
  consoleLog: ConsoleEntry[];
  cases: VapingCase[];
  transcript: string;
  lastResponse: string;
  sessionActive: boolean;
  onToggleSession: () => void;
  clearLogs: () => void;
}) {
  const [mobileTab, setMobileTab] = useState<"assistant" | "console" | "cases">("assistant");

  const mobileTabs = [
    { id: "assistant" as const, label: "Assistant", icon: <MessageSquare size={14} /> },
    { id: "console"   as const, label: "Console",   icon: <Terminal size={14} />,      badge: consoleLog.length },
    { id: "cases"     as const, label: "Cases",     icon: <FileText size={14} />,       badge: cases.length     },
  ];

  const hints = [
    "What are the penalties for vaping in Singapore?",
    "Is heated tobacco like IQOS legal here?",
    "How do I report a shop selling vapes?",
    "What are the health risks of e-cigarettes?",
    "I need to speak to an officer",
  ];

  const CenterPanel = () => (
    <div className="flex flex-col items-center gap-5 w-full">
      <div className="pt-2"><VoiceAura status={status} /></div>

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

      <button onClick={onToggleSession}
        className={`w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-semibold text-sm transition-all shadow ${
          sessionActive
            ? "bg-red-50 border border-red-200 text-red-700 hover:bg-red-100"
            : "bg-blue-800 text-white hover:bg-blue-900"
        }`}>
        {sessionActive ? <><MicOff size={16} /> End Session</> : <><Mic size={16} /> Start Voice Session</>}
      </button>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 w-full">
        {[
          { icon: <CheckCircle2 size={12} className="text-emerald-500" />, label: "Resolved", value: cases.filter(c => c.status === "resolved").length, color: "text-emerald-700" },
          { icon: <Clock size={12} className="text-amber-500" />,          label: "Open",     value: cases.filter(c => c.status === "open").length,     color: "text-amber-700"  },
          { icon: <FileText size={12} className="text-blue-500" />,        label: "Total",    value: cases.length,                                       color: "text-blue-700"   },
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
          <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wide mb-2">Try asking:</p>
          {hints.map((h, i) => (
            <div key={i} className="flex items-start gap-1.5 text-slate-600 text-xs mb-1.5">
              <ChevronRight size={10} className="text-blue-500 shrink-0 mt-0.5" />
              <span>&ldquo;{h}&rdquo;</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-xs font-medium mb-3">
          <ShieldCheck className="w-3.5 h-3.5" /> Singapore Vaping Information Helpline
        </div>
        <h1 className="text-2xl md:text-3xl font-bold text-slate-900">ARIA Voice Assistant</h1>
        <p className="text-slate-500 text-sm mt-1">
          Ask any vaping question in natural language — or say &ldquo;I need to speak to an officer&rdquo; to log a callback case
        </p>
      </div>

      {/* Desktop 3-col */}
      <div className="hidden lg:grid lg:grid-cols-3 gap-6" style={{ minHeight: "calc(100vh - 280px)" }}>
        <div className="flex flex-col">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <Terminal size={12} /> System Console
          </h2>
          <div className="flex-1 overflow-hidden" style={{ maxHeight: "calc(100vh - 340px)" }}>
            <ConsolePanel logs={consoleLog} onClear={clearLogs} />
          </div>
        </div>

        <div className="flex flex-col items-center">
          <CenterPanel />
        </div>

        <div className="flex flex-col">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <FileText size={12} /> Callback Cases
            {cases.length > 0 && (
              <span className="ml-auto bg-blue-100 text-blue-700 text-[10px] font-semibold px-2 py-0.5 rounded-full">
                {cases.length}
              </span>
            )}
          </h2>
          <div className="flex-1 overflow-y-auto space-y-3 scrollbar-thin scrollbar-thumb-slate scrollbar-track-transparent pr-1" style={{ maxHeight: "calc(100vh - 340px)" }}>
            {cases.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                <Phone size={32} className="mb-3 opacity-30" />
                <p className="text-sm font-medium">No cases logged yet</p>
                <p className="text-xs mt-1 text-center">Say &ldquo;I need an officer callback&rdquo; to log a case</p>
              </div>
            ) : (
              [...cases].reverse().map((c) => <CaseCard key={c.id} c={c} />)
            )}
          </div>
        </div>
      </div>

      {/* Mobile tabs */}
      <div className="lg:hidden">
        <div className="flex border-b border-slate-200 mb-5">
          {mobileTabs.map((tab) => (
            <button key={tab.id} onClick={() => setMobileTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-semibold border-b-2 transition-colors relative ${
                mobileTab === tab.id ? "border-blue-700 text-blue-800" : "border-transparent text-slate-500"
              }`}>
              {tab.icon}{tab.label}
              {tab.badge !== undefined && tab.badge > 0 && (
                <span className="bg-blue-700 text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                  {tab.badge > 99 ? "99+" : tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {mobileTab === "assistant" && <CenterPanel />}
        {mobileTab === "console" && <div className="h-[500px]"><ConsolePanel logs={consoleLog} onClear={clearLogs} /></div>}
        {mobileTab === "cases" && (
          <div className="space-y-3">
            {cases.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                <Phone size={32} className="mb-3 opacity-30" />
                <p className="text-sm font-medium">No cases yet</p>
                <p className="text-xs mt-1">Say &ldquo;I need an officer callback&rdquo;</p>
              </div>
            ) : (
              [...cases].reverse().map((c) => <CaseCard key={c.id} c={c} />)
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Track Page ────────────────────────────────────────────────────────────────
function TrackPage({ cases }: { cases: VapingCase[] }) {
  const [search, setSearch] = useState("");
  const filtered = cases.filter((c) =>
    c.id.toLowerCase().includes(search.toLowerCase()) ||
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.contact.includes(search) ||
    c.query.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-slate-900 mb-1">Track My Case</h1>
        <p className="text-slate-500 text-sm">Search for your callback case using your reference number, name, or contact</p>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input type="text" placeholder="Search by case ID (e.g. VPG-...), name, or contact number..."
          value={search} onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: "Total",    value: cases.length,                                     color: "text-blue-700",  bg: "bg-blue-50",  border: "border-blue-200"  },
          { label: "Open",     value: cases.filter(c => c.status === "open").length,     color: "text-amber-700", bg: "bg-amber-50", border: "border-amber-200" },
          { label: "Resolved", value: cases.filter(c => c.status === "resolved").length, color: "text-green-700", bg: "bg-green-50", border: "border-green-200" },
        ].map((s) => (
          <div key={s.label} className={`${s.bg} border ${s.border} rounded-xl p-4 text-center`}>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-slate-500 uppercase tracking-wide mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Cases */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
          <TrendingUp size={36} className="mb-3 opacity-30" />
          <p className="font-medium">{cases.length === 0 ? "No cases logged yet" : "No results found"}</p>
          <p className="text-sm mt-1">
            {cases.length === 0
              ? "Ask ARIA to log a callback case for you"
              : "Try a different search term"}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {[...filtered].reverse().map((c) => (
            <div key={c.id} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <User size={14} className="text-slate-400" />
                    <span className="font-semibold text-slate-800">{c.name}</span>
                    <span className="font-mono text-xs text-slate-400">{c.id}</span>
                  </div>
                  <p className="text-slate-600 text-sm">{c.query}</p>
                </div>
                <span className={`shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full uppercase tracking-wide ${CASE_STATUS_STYLE[c.status]}`}>
                  {c.status.replace("_", " ")}
                </span>
              </div>

              <div className="grid sm:grid-cols-2 gap-3 border-t border-slate-100 pt-4 text-sm text-slate-600">
                <div className="flex items-center gap-2"><Phone size={13} className="text-slate-400" />{c.contact}</div>
                {c.email && <div className="flex items-center gap-2"><Mail size={13} className="text-slate-400" />{c.email}</div>}
                {c.callbackTime && (
                  <div className="flex items-center gap-2"><Calendar size={13} className="text-slate-400" />Callback: {c.callbackTime}</div>
                )}
                <div className="flex items-center gap-2"><Clock size={13} className="text-slate-400" />{new Date(c.createdAt).toLocaleString()}</div>
              </div>

              {c.notes && (
                <div className="mt-3 bg-slate-50 rounded-lg p-3 text-xs text-slate-500">{c.notes}</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function Page() {
  const { status, consoleLog, cases, transcript, lastResponse, startSession, stopSession, clearLogs } = useVoiceAgent();
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
        {page === "home"      && <HomePage onNav={setPage} />}
        {page === "assistant" && (
          <AssistantPage
            status={status} consoleLog={consoleLog} cases={cases}
            transcript={transcript} lastResponse={lastResponse}
            sessionActive={sessionActive} onToggleSession={handleToggleSession}
            clearLogs={clearLogs}
          />
        )}
        {page === "track" && <TrackPage cases={cases} />}
      </div>
    </>
  );
}
