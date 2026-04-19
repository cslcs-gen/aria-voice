"use client";
// app/page.tsx — ARIA v4.0 — Full portal with FAQ generator + Offender Case Mgmt

import { useRef, useState, useEffect, useCallback } from "react";
import {
  Mic, MicOff, Terminal, ShieldCheck, Search, MessageSquare,
  Menu, X, ArrowRight, FileText, CheckCircle2, Clock, AlertCircle,
  Activity, Zap, Radio, ChevronRight, Phone, Mail, Calendar, User,
  TrendingUp, Shield, Send, RotateCcw, RefreshCw, BookOpen,
  AlertTriangle, Gavel, HeartPulse, Building2, ChevronDown, ChevronUp,
  BadgeAlert, Lock, ExternalLink, MapPin, Navigation2, Heart,
} from "lucide-react";
import {
  useVoiceAgent, type ConsoleEntry, type AgentStatus,
  type VapingCase, type OffenderCase, type Language,
} from "@/hooks/useVoiceAgent";

type NavPage = "home" | "assistant" | "faq" | "offender" | "track" | "laws" | "health" | "surrender";

// ── Status config ─────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<AgentStatus, { label: string; textColor: string; bgColor: string; borderColor: string; glowColor: string; pulse: boolean }> = {
  idle:      { label: "Ready",      textColor: "text-slate-500",   bgColor: "bg-slate-100",  borderColor: "border-slate-300",   glowColor: "#94a3b8", pulse: false },
  listening: { label: "Listening",  textColor: "text-emerald-700", bgColor: "bg-emerald-50", borderColor: "border-emerald-400", glowColor: "#10b981", pulse: true  },
  thinking:  { label: "Processing", textColor: "text-amber-700",   bgColor: "bg-amber-50",   borderColor: "border-amber-400",   glowColor: "#f59e0b", pulse: true  },
  speaking:  { label: "Responding", textColor: "text-blue-700",    bgColor: "bg-blue-50",    borderColor: "border-blue-400",    glowColor: "#3b82f6", pulse: true  },
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
const TIER_CONFIG: Record<number, { label: string; color: string; bg: string; border: string; icon: React.ReactNode }> = {
  1: { label: "Tier 1 — First Offence",   color: "text-amber-700",  bg: "bg-amber-50",  border: "border-amber-300",  icon: <AlertTriangle size={14} /> },
  2: { label: "Tier 2 — Repeat Offence",  color: "text-orange-700", bg: "bg-orange-50", border: "border-orange-300", icon: <BadgeAlert size={14} /> },
  3: { label: "Tier 3 — Serious Offence", color: "text-red-700",    bg: "bg-red-50",    border: "border-red-300",    icon: <Gavel size={14} /> },
};
const FAQ_CATEGORY_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  laws_penalties:       { label: "Laws & Penalties",      color: "text-blue-700",   bg: "bg-blue-50",   icon: <Gavel size={13} /> },
  health_education:     { label: "Health Education",      color: "text-red-700",    bg: "bg-red-50",    icon: <HeartPulse size={13} /> },
  reporting:            { label: "How to Report",         color: "text-green-700",  bg: "bg-green-50",  icon: <Shield size={13} /> },
  business_compliance:  { label: "Business Compliance",   color: "text-violet-700", bg: "bg-violet-50", icon: <Building2 size={13} /> },
  offender_rights:      { label: "Offender Rights",       color: "text-amber-700",  bg: "bg-amber-50",  icon: <Lock size={13} /> },
  minors_protection:    { label: "Minors Protection",     color: "text-teal-700",   bg: "bg-teal-50",   icon: <ShieldCheck size={13} /> },
};

// ── Shared components ─────────────────────────────────────────────────────────
function VoiceAura({ status }: { status: AgentStatus }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <div className="relative flex items-center justify-center flex-shrink-0" style={{ width: 160, height: 160 }}>
      {[130, 104, 78].map((r, i) => (
        <div key={i} className="absolute rounded-full border-2 transition-all duration-700"
          style={{ width: r, height: r, borderColor: cfg.glowColor,
            opacity: cfg.pulse ? 0.1 + i * 0.06 : 0.04,
            animation: cfg.pulse ? `ping ${1.6 + i * 0.3}s cubic-bezier(0,0,0.2,1) infinite` : "none",
            animationDelay: `${i * 200}ms` }} />
      ))}
      <div className={`relative z-10 w-16 h-16 rounded-full flex items-center justify-center border-2 ${cfg.borderColor} ${cfg.bgColor} shadow-lg transition-all duration-500`}
        style={{ boxShadow: cfg.pulse ? `0 0 24px 4px ${cfg.glowColor}33` : "none" }}>
        {status === "listening" ? <Radio size={22} className={cfg.textColor + " animate-pulse"} />
        : status === "thinking"  ? <Activity size={22} className={cfg.textColor + " animate-spin-slow"} />
        : status === "speaking"  ? <Zap size={22} className={cfg.textColor + " animate-bounce"} />
        : status === "error"     ? <AlertCircle size={22} className={cfg.textColor} />
        : <Mic size={22} className={cfg.textColor} />}
      </div>
      <div className={`absolute -bottom-3 px-2.5 py-0.5 rounded-full text-[10px] font-semibold border shadow-sm ${cfg.bgColor} ${cfg.textColor} ${cfg.borderColor}`}>
        {cfg.label}
      </div>
    </div>
  );
}

function Navigation({ page, onNav }: { page: NavPage; onNav: (p: NavPage) => void }) {
  const [open, setOpen] = useState(false);
  const items: { id: NavPage; label: string }[] = [
    { id: "home",      label: "Home"          },
    { id: "assistant", label: "Ask ARIA"       },
    { id: "laws",      label: "Laws"           },
    { id: "health",    label: "Health Risks"   },
    { id: "surrender", label: "Surrender"      },
    { id: "faq",       label: "FAQ"            },
    { id: "offender",  label: "My Case"        },
    { id: "track",     label: "Callback Cases" },
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
              <p className="text-[10px] text-slate-500 leading-none mt-0.5">Vaping Info Helpline</p>
            </div>
          </button>
          <div className="hidden md:flex items-center gap-5">
            {items.map(item => (
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
            {items.map(item => (
              <button key={item.id} onClick={() => { onNav(item.id); setOpen(false); }}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm ${page === item.id ? "bg-blue-50 text-blue-800 font-semibold" : "text-slate-600 hover:bg-slate-50"}`}>
                {item.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </nav>
  );
}

function ConsolePanel({ logs, onClear }: { logs: ConsoleEntry[]; onClear: () => void }) {
  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [logs]);
  return (
    <div className="flex flex-col h-full bg-slate-950 rounded-xl overflow-hidden border border-slate-200 shadow-sm">
      <div className="flex items-center justify-between px-3 py-2 bg-slate-900 border-b border-slate-700">
        <div className="flex items-center gap-2"><Terminal size={11} className="text-emerald-400" /><span className="text-[10px] font-mono font-semibold tracking-widest text-slate-300 uppercase">Activity Log</span></div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1"><span className="w-2 h-2 rounded-full bg-red-500/80" /><span className="w-2 h-2 rounded-full bg-amber-400/80" /><span className="w-2 h-2 rounded-full bg-emerald-500/80" /></div>
          <button onClick={onClear} className="text-[9px] font-mono text-slate-500 hover:text-slate-300">clear</button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-0.5 font-mono text-[10px] scrollbar-thin scrollbar-thumb-slate scrollbar-track-transparent">
        {logs.map(e => {
          const s = LOG_STYLE[e.type];
          return (<div key={e.id} className="flex gap-1.5"><span className="text-slate-600 shrink-0 hidden sm:inline">{e.timestamp}</span><span className={`shrink-0 w-10 ${s.color} font-bold`}>[{s.prefix}]</span><span className={`${s.color} break-all leading-relaxed`}>{e.message}</span></div>);
        })}
        <div ref={bottomRef} />
      </div>
      <div className="px-3 py-1.5 bg-slate-900 border-t border-slate-700">
        <span className="font-mono text-[9px] text-emerald-400">aria@helpline:~$ <span className="animate-pulse">▋</span></span>
      </div>
    </div>
  );
}

function ChatBubbles({ history }: { history: Array<{ role: "user" | "aria"; text: string }> }) {
  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [history]);
  if (history.length === 0) return null;
  return (
    <div className="w-full flex flex-col gap-2 max-h-60 overflow-y-auto scrollbar-thin scrollbar-thumb-slate scrollbar-track-transparent pr-1">
      {history.map((msg, i) => (
        <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
          <div className={`max-w-[88%] px-3.5 py-2.5 rounded-2xl text-sm shadow-sm ${msg.role === "user" ? "bg-blue-800 text-white rounded-tr-sm" : "bg-white border border-slate-200 text-slate-800 rounded-tl-sm"}`}>
            {msg.role === "aria" && <p className="text-[9px] text-blue-500 font-semibold mb-0.5">ARIA</p>}
            <p className="leading-relaxed">{msg.text}</p>
          </div>
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}

function TextInput({ onSend, status, placeholder }: { onSend: (text: string) => void; status: AgentStatus; placeholder?: string }) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const isBusy = status === "thinking" || status === "speaking";
  const handleSend = () => { if (!value.trim()) return; onSend(value.trim()); setValue(""); inputRef.current?.focus(); };
  return (
    <div className="w-full flex gap-2">
      <div className="flex-1 relative">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleSend()}
          placeholder={placeholder ?? "Type your question and press Enter..."}
          className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm text-slate-900 placeholder-slate-400 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 pr-9"
          style={{ color: "#1e293b" }}
        />
        {isBusy && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>
      <button
        onClick={handleSend}
        disabled={!value.trim()}
        className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-blue-800 text-white rounded-xl font-semibold text-sm hover:bg-blue-900 transition-colors disabled:opacity-40 shadow flex-shrink-0"
      >
        <Send size={14} />
      </button>
    </div>
  );
}

// ── Home Page ─────────────────────────────────────────────────────────────────
function HomePage({ onNav }: { onNav: (p: NavPage) => void }) {
  const features = [
    { icon: Shield,        title: "Laws & Penalties",     desc: "Singapore vaping laws, fines up to SGD 10,000, prohibited activities",             page: "laws"      as NavPage, color: "text-blue-600",   bg: "bg-blue-50"   },
    { icon: BookOpen,      title: "Self-Updating FAQ",    desc: "ARIA reads the Tobacco Act and auto-generates FAQs with last-updated timestamps",   page: "faq"       as NavPage, color: "text-violet-600", bg: "bg-violet-50" },
    { icon: Gavel,         title: "Offender Case Lookup", desc: "Retrieve your enforcement case, penalties, and next steps by NRIC or case ref",     page: "offender"  as NavPage, color: "text-red-600",    bg: "bg-red-50"    },
    { icon: Activity,      title: "Health Risks",         desc: "Short and long-term health effects of vaping, myths vs facts",                       page: "health"    as NavPage, color: "text-orange-600", bg: "bg-orange-50" },
    { icon: MapPin,        title: "Surrender Your Vape",  desc: "Find authorised surrender centres near you and learn the procedure step by step",    page: "surrender" as NavPage, color: "text-amber-600",  bg: "bg-amber-50"  },
    { icon: Phone,         title: "Officer Callback",     desc: "Cannot find your answer? ARIA logs a case and arranges an officer to call back",     page: "track"     as NavPage, color: "text-teal-600",   bg: "bg-teal-50"   },
  ];
  return (
    <div className="min-h-screen">
      <section className="bg-gradient-to-b from-blue-50 to-white py-16 md:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-100 text-blue-800 border border-blue-200 text-sm font-medium">
                <ShieldCheck className="w-4 h-4" />Singapore Vaping Enforcement & Public Health
              </div>
              <h1 className="text-4xl md:text-5xl font-bold leading-tight text-slate-900">
                Singapore's Vaping<br />Information Helpline<br /><span className="text-blue-800">Powered by ARIA AI.</span>
              </h1>
              <p className="text-lg text-slate-500 max-w-xl">Ask about laws, health risks, report violations, look up your enforcement case, or request an officer callback — by voice or text, 24 hours a day.</p>
              <div className="flex flex-col sm:flex-row gap-3">
                <button onClick={() => onNav("assistant")} className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-blue-800 text-white rounded-lg font-semibold text-sm hover:bg-blue-900 transition-colors shadow">Ask ARIA Now <ArrowRight className="w-4 h-4" /></button>
                <button onClick={() => onNav("offender")} className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-white text-slate-700 rounded-lg font-semibold text-sm border border-slate-200 hover:bg-slate-50 transition-colors shadow-sm">Look Up My Case</button>
              </div>
              <div className="grid grid-cols-3 gap-4 pt-4 border-t border-slate-200">
                {[{ value:"24/7",label:"Helpline",note:"Always online"},{value:"SGD 10K",label:"Max Penalty",note:"Know the law"},{value:"5 Cases",label:"Demo Scenarios",note:"All penalty tiers"}].map((s,i) => (
                  <div key={i}><p className="text-xl font-bold text-slate-900">{s.value}</p><p className="text-xs text-slate-500">{s.label}</p><p className="text-xs text-emerald-600 font-medium">{s.note}</p></div>
                ))}
              </div>
            </div>
            <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2"><MessageSquare className="w-5 h-5 text-blue-700" /><span className="font-semibold text-slate-800">ARIA Helpline Assistant</span></div>
                <span className="flex items-center gap-1.5 text-xs text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-full font-medium"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />Online</span>
              </div>
              <div className="flex justify-center py-2"><VoiceAura status="idle" /></div>
              <div className="space-y-1.5">
                <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wide">What ARIA can do:</p>
                {["Answer vaping law questions by voice or text","Auto-generate FAQs from the Tobacco Act","Look up your enforcement case by NRIC","Explain your fine, rehabilitation, or jail term","Log a callback case for officer follow-up"].map((q,i) => (
                  <div key={i} className="flex items-start gap-1.5 text-slate-600 text-xs"><ChevronRight size={10} className="text-blue-500 shrink-0 mt-0.5" /><span>{q}</span></div>
                ))}
              </div>
              <button onClick={() => onNav("assistant")} className="w-full flex items-center justify-center gap-2 py-3 bg-blue-800 text-white rounded-lg font-semibold text-sm hover:bg-blue-900 transition-colors"><MessageSquare className="w-4 h-4" /> Start Asking</button>
            </div>
          </div>
        </div>
      </section>
      <section className="py-14 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10"><h2 className="text-3xl font-bold text-slate-900 mb-3">ARIA's Capabilities</h2><p className="text-slate-500 text-sm max-w-xl mx-auto">A fully autonomous, voice-enabled AI assistant for Singapore's vaping enforcement helpline</p></div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((t, i) => (
              <button key={i} onClick={() => onNav(t.page)} className="group text-left bg-white border border-slate-200 rounded-xl p-6 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
                <div className={`w-11 h-11 rounded-lg ${t.bg} flex items-center justify-center mb-4`}><t.icon className={`w-5 h-5 ${t.color}`} /></div>
                <div className="flex items-start justify-between gap-2 mb-1"><h3 className="font-semibold text-slate-800">{t.title}</h3><ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-blue-700 group-hover:translate-x-0.5 transition-all shrink-0 mt-0.5" /></div>
                <p className="text-slate-500 text-sm">{t.desc}</p>
              </button>
            ))}
          </div>
        </div>
      </section>
      <section className="py-8 bg-amber-50 border-y border-amber-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-start gap-3"><AlertCircle className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" /><div><p className="font-semibold text-amber-900">Vaping is Illegal in Singapore</p><p className="text-amber-700 text-sm mt-0.5">Possession, use, importation and sale of e-cigarettes carry fines up to SGD 10,000 and possible imprisonment.</p></div></div>
          <a href="https://www.hsa.gov.sg" target="_blank" rel="noopener noreferrer" className="shrink-0 inline-flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-semibold hover:bg-amber-700 transition-colors">Visit HSA <ExternalLink className="w-3.5 h-3.5" /></a>
        </div>
      </section>
    </div>
  );
}

// ── FAQ Page ──────────────────────────────────────────────────────────────────
interface FAQEntry { id: string; category: string; question: string; answer: string; relevantSection: string; }
interface FAQState { faqs: FAQEntry[]; lastUpdated: string | null; actVersion: string; actSource: string; generatedBy: string; totalGenerated: number; }

function FAQPage() {
  const [faqData, setFaqData] = useState<FAQState | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState("all");
  const [progress, setProgress] = useState(0);
  const [progressMsg, setProgressMsg] = useState("");

  // Load existing FAQs on mount
  useEffect(() => {
    setLoading(true);
    fetch("/api/faq-generate").then(r => r.json()).then(data => { if (data.faqs?.length) setFaqData(data); }).finally(() => setLoading(false));
  }, []);

  const handleGenerate = useCallback(async () => {
    setGenerating(true);
    setProgress(0);
    setProgressMsg("Connecting to Singapore Statutes Online...");

    // Animate progress steps for pitch demo effect
    const steps = [
      { pct: 15, msg: "Downloading Tobacco (Control of Advertisements and Sale) Act..." },
      { pct: 30, msg: "Parsing Act sections and subsections..." },
      { pct: 50, msg: "ARIA reading legal text — identifying key provisions..." },
      { pct: 70, msg: "Generating plain-English FAQs for public and offenders..." },
      { pct: 85, msg: "Categorising and validating FAQ accuracy..." },
      { pct: 95, msg: "Finalising and timestamping FAQ database..." },
    ];

    let stepIdx = 0;
    const interval = setInterval(() => {
      if (stepIdx < steps.length) {
        setProgress(steps[stepIdx].pct);
        setProgressMsg(steps[stepIdx].msg);
        stepIdx++;
      }
    }, 700);

    try {
      const res = await fetch("/api/faq-generate", { method: "POST" });
      const data = await res.json();
      clearInterval(interval);
      setProgress(100);
      setProgressMsg("FAQ database updated successfully.");
      setTimeout(() => { setGenerating(false); setProgress(0); setProgressMsg(""); if (data.success) setFaqData(data); }, 1000);
    } catch {
      clearInterval(interval);
      setGenerating(false);
      setProgress(0);
      setProgressMsg("");
    }
  }, []);

  const categories = ["all", ...Array.from(new Set((faqData?.faqs ?? []).map(f => f.category)))];
  const filtered = activeCategory === "all" ? (faqData?.faqs ?? []) : (faqData?.faqs ?? []).filter(f => f.category === activeCategory);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-violet-50 text-violet-700 border border-violet-200 text-xs font-medium mb-3">
          <BookOpen className="w-3.5 h-3.5" /> AI-Powered FAQ Generator
        </div>
        <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Frequently Asked Questions</h1>
        <p className="text-slate-500 text-sm mt-1">ARIA reads Singapore's Tobacco Act and auto-generates these FAQs. Click Refresh to regenerate from the latest Act version.</p>
      </div>

      {/* Admin Panel */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 mb-6 shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1.5"><BookOpen size={11} /> Act Source</p>
            <p className="text-sm font-medium text-slate-800">Tobacco (Control of Advertisements and Sale) Act (Cap 309)</p>
            {faqData?.lastUpdated && (
              <div className="flex flex-wrap gap-3 mt-1">
                <span className="inline-flex items-center gap-1 text-[10px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                  <Clock size={9} /> Last generated: {new Date(faqData.lastUpdated).toLocaleString()}
                </span>
                <span className="inline-flex items-center gap-1 text-[10px] text-violet-700 bg-violet-50 px-2 py-0.5 rounded-full border border-violet-200">
                  <CheckCircle2 size={9} /> {faqData.totalGenerated} FAQs generated
                </span>
                <a href="https://sso.agc.gov.sg/Act/TCASA1993" target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[10px] text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200 hover:bg-blue-100 transition-colors">
                  <ExternalLink size={9} /> View Act on AGC
                </a>
              </div>
            )}
            {!faqData?.lastUpdated && <p className="text-xs text-slate-400 italic">No FAQs generated yet. Click Refresh to generate.</p>}
          </div>
          <button onClick={handleGenerate} disabled={generating}
            className="flex-shrink-0 flex items-center gap-2 px-5 py-2.5 bg-violet-700 text-white rounded-xl font-semibold text-sm hover:bg-violet-800 transition-colors disabled:opacity-60 shadow">
            <RefreshCw size={15} className={generating ? "animate-spin" : ""} />
            {generating ? "Generating..." : "Refresh FAQs"}
          </button>
        </div>

        {/* Progress bar */}
        {generating && (
          <div className="mt-4 space-y-2">
            <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
              <div className="h-2 bg-violet-600 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <Activity size={11} className="text-violet-500 animate-pulse" />
              {progressMsg}
            </div>
          </div>
        )}

        {faqData?.generatedBy && !generating && (
          <p className="mt-3 text-[10px] text-slate-400 flex items-center gap-1"><ShieldCheck size={9} className="text-emerald-500" />{faqData.generatedBy}</p>
        )}
      </div>

      {loading && <div className="flex items-center justify-center py-16 text-slate-400"><Activity size={24} className="animate-spin mr-2" />Loading FAQs...</div>}

      {!loading && faqData?.faqs?.length ? (
        <>
          {/* Category filter */}
          <div className="flex flex-wrap gap-2 mb-5">
            {categories.map(cat => {
              const cfg = FAQ_CATEGORY_CONFIG[cat];
              return (
                <button key={cat} onClick={() => setActiveCategory(cat)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                    activeCategory === cat
                      ? "bg-blue-800 text-white border-blue-800"
                      : "bg-white text-slate-600 border-slate-200 hover:border-blue-300"
                  }`}>
                  {cfg?.icon}{cfg?.label ?? "All Topics"}
                </button>
              );
            })}
          </div>

          {/* FAQ list */}
          <div className="space-y-3">
            {filtered.map(faq => {
              const cfg = FAQ_CATEGORY_CONFIG[faq.category];
              const isOpen = expandedId === faq.id;
              return (
                <div key={faq.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                  <button onClick={() => setExpandedId(isOpen ? null : faq.id)} className="w-full text-left px-5 py-4 flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        {cfg && <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.color}`}>{cfg.icon}{cfg.label}</span>}
                        <span className="text-[10px] text-slate-400">{faq.relevantSection}</span>
                      </div>
                      <p className="font-medium text-slate-800 text-sm">{faq.question}</p>
                    </div>
                    {isOpen ? <ChevronUp size={16} className="text-slate-400 shrink-0 mt-0.5" /> : <ChevronDown size={16} className="text-slate-400 shrink-0 mt-0.5" />}
                  </button>
                  {isOpen && (
                    <div className="px-5 pb-4 pt-0 border-t border-slate-100">
                      <p className="text-slate-600 text-sm leading-relaxed">{faq.answer}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      ) : !loading && (
        <div className="flex flex-col items-center justify-center py-16 text-slate-400 text-center">
          <BookOpen size={36} className="mb-3 opacity-30" />
          <p className="font-medium">No FAQs generated yet</p>
          <p className="text-sm mt-1">Click "Refresh FAQs" above to have ARIA read the Tobacco Act and auto-generate questions</p>
        </div>
      )}
    </div>
  );
}

// ── Offender Case Page ────────────────────────────────────────────────────────
function OffenderPage({ lookedUpCases, onTextSend, status, chatHistory }: {
  lookedUpCases: OffenderCase[];
  onTextSend: (text: string) => void;
  status: AgentStatus;
  chatHistory: Array<{ role: "user" | "aria"; text: string }>;
}) {
  const [search, setSearch] = useState("");
  const [selectedCase, setSelectedCase] = useState<OffenderCase | null>(null);
  const isProcessing = status === "thinking" || status === "speaking";

  const handleSearch = () => {
    if (!search.trim()) return;
    onTextSend(`Look up my case. My identifier is ${search.trim()}`);
    setSearch("");
  };

  const demoNrics = [
    { nric: "S8712123A", label: "Tan Wei Ming — Tier 1 Fine" },
    { nric: "T9234890B", label: "Priya Rajendran — Tier 2 Fine + Rehab" },
    { nric: "S7845456C", label: "Ahmad Farhan — Tier 3 Fine + Jail" },
    { nric: "G9912789D", label: "Jason Loh — Tier 3 Sale to Minor" },
    { nric: "OFC-2023-0445", label: "Siti Nur — Resolved Retail Case" },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-50 text-red-700 border border-red-200 text-xs font-medium mb-3">
          <Gavel className="w-3.5 h-3.5" /> Enforcement Case Management
        </div>
        <h1 className="text-2xl md:text-3xl font-bold text-slate-900">My Enforcement Case</h1>
        <p className="text-slate-500 text-sm mt-1">Look up your vaping enforcement case by NRIC or case reference number. You can also ask ARIA by voice.</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-5 mb-6">
        {/* Search panel */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <h2 className="font-semibold text-slate-800 mb-3 flex items-center gap-2"><Search size={15} className="text-blue-600" />Search Your Case</h2>
          <div className="flex gap-2 mb-4">
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === "Enter" && handleSearch()}
              placeholder="Enter NRIC (e.g. S8712123A) or case ref (e.g. OFC-2024-0891)"
              className="flex-1 px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm text-slate-900 placeholder-slate-400 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              style={{ color: "#1e293b" }} />
            <button onClick={handleSearch} disabled={!search.trim()}
              className="px-4 py-2.5 bg-blue-800 text-white rounded-xl font-semibold text-sm hover:bg-blue-900 disabled:opacity-40 shadow">
              <Search size={15} />
            </button>
          </div>
          <div className="border-t border-slate-100 pt-4">
            <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wide mb-2">Demo cases — click to load:</p>
            <div className="space-y-1.5">
              {demoNrics.map((d, i) => (
                <button key={i} onClick={() => onTextSend(`Look up my case. My NRIC or reference is ${d.nric}`)}
                  className="w-full flex items-center justify-between text-left px-3 py-2 rounded-lg border border-slate-200 hover:border-blue-300 hover:bg-blue-50 transition-colors group">
                  <div>
                    <p className="text-xs font-medium text-slate-700">{d.label}</p>
                    <p className="text-[10px] font-mono text-slate-400">{d.nric}</p>
                  </div>
                  <ChevronRight size={13} className="text-slate-400 group-hover:text-blue-600 transition-colors" />
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ARIA chat for voice lookup */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col gap-3">
          <h2 className="font-semibold text-slate-800 flex items-center gap-2"><Mic size={15} className="text-blue-600" />Ask ARIA by Voice or Text</h2>
          <ChatBubbles history={chatHistory.slice(-6)} />
          <TextInput onSend={onTextSend} status={status} />
          <p className="text-[10px] text-slate-400 text-center">Say: "Look up my case, my NRIC is S8712123A"</p>
        </div>
      </div>

      {/* Looked-up cases */}
      {lookedUpCases.length > 0 && (
        <div className="space-y-5">
          <h2 className="font-semibold text-slate-800 flex items-center gap-2"><FileText size={15} />Retrieved Cases</h2>
          {lookedUpCases.map(c => {
            const tierCfg = TIER_CONFIG[c.penaltyTier];
            const isSelected = selectedCase?.caseRef === c.caseRef;
            return (
              <div key={c.caseRef} className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                {/* Case header */}
                <button onClick={() => setSelectedCase(isSelected ? null : c)} className="w-full text-left p-5 hover:bg-slate-50 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-slate-900 text-lg">{c.name}</span>
                        <span className="font-mono text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded">{c.caseRef}</span>
                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border flex items-center gap-1 ${tierCfg.bg} ${tierCfg.color} ${tierCfg.border}`}>
                          {tierCfg.icon}{tierCfg.label}
                        </span>
                      </div>
                      <p className="text-slate-600 text-sm font-medium">{c.offenceType}</p>
                      <div className="flex flex-wrap gap-3 text-xs text-slate-500">
                        <span className="flex items-center gap-1"><Calendar size={10} />{c.offenceDate}</span>
                        <span className="flex items-center gap-1"><User size={10} />{c.nric}</span>
                        <span className={`font-semibold capitalize ${c.status === "resolved" ? "text-green-600" : c.status === "appealing" ? "text-amber-600" : "text-red-600"}`}>{c.status}</span>
                      </div>
                    </div>
                    {isSelected ? <ChevronUp size={18} className="text-slate-400 shrink-0" /> : <ChevronDown size={18} className="text-slate-400 shrink-0" />}
                  </div>
                </button>

                {/* Expanded detail */}
                {isSelected && (
                  <div className="border-t border-slate-200 p-5 space-y-5">
                    {/* Description */}
                    <div className="bg-slate-50 rounded-xl p-4">
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Offence Description</p>
                      <p className="text-slate-700 text-sm leading-relaxed">{c.description}</p>
                      <p className="text-xs text-slate-500 mt-2 flex items-center gap-1"><User size={10} />{c.location}</p>
                    </div>

                    {/* Penalties */}
                    <div>
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Penalties Imposed</p>
                      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {c.penalties.fine && (
                          <div className={`p-4 rounded-xl border ${c.penalties.fine.paid ? "bg-green-50 border-green-200" : "bg-amber-50 border-amber-200"}`}>
                            <p className={`text-[10px] font-semibold uppercase tracking-wide mb-1 ${c.penalties.fine.paid ? "text-green-600" : "text-amber-600"}`}>Financial Penalty</p>
                            <p className="text-2xl font-bold text-slate-800">SGD {c.penalties.fine.amount.toLocaleString()}</p>
                            <p className={`text-xs font-semibold mt-1 ${c.penalties.fine.paid ? "text-green-600" : "text-amber-700"}`}>{c.penalties.fine.paid ? "✓ Paid in full" : `Due: ${c.penalties.fine.dueDate}`}</p>
                          </div>
                        )}
                        {c.penalties.rehabilitation && (
                          <div className="p-4 rounded-xl border bg-blue-50 border-blue-200">
                            <p className="text-[10px] font-semibold text-blue-600 uppercase tracking-wide mb-1">Rehabilitation</p>
                            <p className="text-sm font-semibold text-slate-800">{c.penalties.rehabilitation.programme}</p>
                            <div className="mt-2">
                              <div className="flex justify-between text-xs text-slate-500 mb-1">
                                <span>{c.penalties.rehabilitation.completedSessions} of {c.penalties.rehabilitation.sessions} sessions</span>
                                <span className={`font-semibold capitalize ${c.penalties.rehabilitation.status === "completed" ? "text-green-600" : c.penalties.rehabilitation.status === "ongoing" ? "text-blue-600" : "text-amber-600"}`}>{c.penalties.rehabilitation.status}</span>
                              </div>
                              <div className="w-full bg-blue-100 rounded-full h-1.5">
                                <div className="h-1.5 bg-blue-600 rounded-full" style={{ width: `${(c.penalties.rehabilitation.completedSessions / c.penalties.rehabilitation.sessions) * 100}%` }} />
                              </div>
                            </div>
                          </div>
                        )}
                        {c.penalties.jailTerm && (
                          <div className="p-4 rounded-xl border bg-red-50 border-red-200">
                            <p className="text-[10px] font-semibold text-red-600 uppercase tracking-wide mb-1">Custodial Sentence</p>
                            <p className="text-2xl font-bold text-slate-800">{c.penalties.jailTerm.duration}</p>
                            <p className="text-xs text-slate-600 mt-1">{c.penalties.jailTerm.facility}</p>
                            <p className={`text-xs font-semibold mt-1 capitalize ${c.penalties.jailTerm.status === "completed" ? "text-green-600" : "text-red-600"}`}>{c.penalties.jailTerm.status} — Release: {c.penalties.jailTerm.releaseDate}</p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Next action */}
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                      <p className="text-[10px] font-semibold text-blue-600 uppercase tracking-wide mb-1">Next Required Action</p>
                      <p className="text-slate-800 text-sm font-medium">{c.nextAction}</p>
                      <p className="text-xs text-slate-500 mt-2 flex items-center gap-1"><User size={10} />{c.caseOfficer}</p>
                      {c.courtDate && <p className="text-xs text-slate-500 flex items-center gap-1 mt-1"><Calendar size={10} />Court date: {c.courtDate}</p>}
                    </div>

                    {/* Timeline */}
                    <div>
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Case Timeline</p>
                      <div className="space-y-3">
                        {c.timeline.map((t, i) => (
                          <div key={i} className="flex gap-3">
                            <div className="flex flex-col items-center">
                              <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${t.completed ? "bg-green-100 text-green-600" : "bg-slate-100 text-slate-400"}`}>
                                {t.completed ? <CheckCircle2 size={13} /> : <Clock size={13} />}
                              </div>
                              {i < c.timeline.length - 1 && <div className={`w-0.5 flex-1 min-h-4 mt-1 ${t.completed ? "bg-green-200" : "bg-slate-200"}`} />}
                            </div>
                            <div className="flex-1 pb-3">
                              <div className="flex items-center justify-between mb-0.5">
                                <p className={`text-xs font-medium ${t.completed ? "text-slate-800" : "text-slate-400"}`}>{t.event}</p>
                                <span className="text-[10px] text-slate-400 shrink-0 ml-2">{t.date}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {lookedUpCases.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-slate-400 text-center">
          <Gavel size={36} className="mb-3 opacity-30" />
          <p className="font-medium">No cases retrieved yet</p>
          <p className="text-sm mt-1">Enter your NRIC or case reference above, or click a demo case</p>
        </div>
      )}
    </div>
  );
}

// ── Assistant Page ────────────────────────────────────────────────────────────
function AssistantPage({ status, consoleLog, callbackCases, chatHistory, sessionActive, onToggleSession, clearLogs, onReset, onTextSend, lang, onLangChange }: {
  status: AgentStatus; consoleLog: ConsoleEntry[]; callbackCases: VapingCase[];
  chatHistory: Array<{ role: "user" | "aria"; text: string }>; sessionActive: boolean;
  onToggleSession: () => void; clearLogs: () => void; onReset: () => void;
  onTextSend: (text: string) => void; lang: Language; onLangChange: (l: Language) => void;
}) {
  const [mobileTab, setMobileTab] = useState<"chat"|"console"|"cases">("chat");
  const [voiceSupported, setVoiceSupported] = useState<boolean | null>(null);
  const [browserName, setBrowserName] = useState<string>("");
  const [isMobileChrome, setIsMobileChrome] = useState(false);

  useEffect(() => {
    const ua = navigator.userAgent;

    // Detect specific browsers
    const isSafari     = /^((?!chrome|android).)*safari/i.test(ua);
    const isFirefox    = ua.includes("Firefox");
    const isEdge       = ua.includes("Edg/");
    const isSamsung    = ua.includes("SamsungBrowser");
    const isUCBrowser  = ua.includes("UCBrowser");
    const isOpera      = ua.includes("OPR/") || ua.includes("Opera");
    const isAndroid    = ua.includes("Android");
    const isIOS        = /iPad|iPhone|iPod/.test(ua);
    const isChromeCore = ua.includes("Chrome") && !isEdge && !isSamsung && !isOpera;
    const isMobileChr  = isChromeCore && (isAndroid || isIOS);
    const isDesktopChr = isChromeCore && !isAndroid && !isIOS;

    // Set browser name for the banner message
    if (isSamsung)       setBrowserName("Samsung Browser");
    else if (isUCBrowser) setBrowserName("UC Browser");
    else if (isOpera)    setBrowserName("Opera");
    else if (isFirefox)  setBrowserName("Firefox");
    else if (isSafari)   setBrowserName("Safari");
    else if (isMobileChr) setBrowserName("Chrome on Mobile");
    else if (isDesktopChr) setBrowserName("Chrome");
    else if (isEdge)     setBrowserName("Edge");
    else                 setBrowserName("your browser");

    setIsMobileChrome(isMobileChr);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    const hasAPI = !!(w.SpeechRecognition || w.webkitSpeechRecognition);

    // Unsupported: Safari, Firefox, Samsung, UC, Opera, iOS Chrome
    // Mobile Android Chrome: has API but unreliable — show warning but allow try
    const unsupported = isSafari || isFirefox || isSamsung || isUCBrowser || isOpera || isIOS;
    const supported   = hasAPI && !unsupported;
    setVoiceSupported(supported);
  }, []);

  const isZh = lang === "zh";
  const isMs = lang === "ms";
  const isTa = lang === "ta";

  const hints =
    isZh ? ["新加坡电子烟罚款是多少？","IQOS在新加坡合法吗？","我怎么举报售卖电子烟的商店？","吸电子烟有什么健康风险？","我需要执法人员回电"] :
    isMs ? ["Apakah hukuman vaping di Singapura?","Adakah IQOS sah di sini?","Bagaimana saya melaporkan kedai yang menjual vape?","Apakah risiko kesihatan vaping?","Saya perlukan pegawai menghubungi saya"] :
    isTa ? ["சிங்கப்பூரில் வேப்பிங் தண்டனை என்ன?","IQOS சட்டப்பூர்வமானதா?","வேப் விற்கும் கடையை எப்படி புகாரளிக்கலாம்?","வேப்பிங்கின் உடல்நல அபாயங்கள் என்ன?","அதிகாரி என்னை திரும்ப அழைக்க வேண்டும்"] :
    ["What are the penalties for vaping in Singapore?","Is IQOS legal here?","How do I report a shop selling e-cigarettes?","What health risks does vaping cause?","I need an officer to call me back"];

  const voiceLabel    = isZh ? "开始语音会话" : isMs ? "Mulakan Sesi Suara" : isTa ? "குரல் அமர்வு தொடங்கு" : "Start Voice";
  const endLabel      = isZh ? "结束会话"     : isMs ? "Tamatkan Sesi"      : isTa ? "அமர்வை முடி"         : "End Voice";
  const resetLabel    = isZh ? "重置对话"     : isMs ? "Tetapkan Semula"    : isTa ? "மீட்டமை"             : "Reset conversation";
  const typeLabel     = isZh ? "输入您的问题：" : isMs ? "Taip soalan anda:" : isTa ? "உங்கள் கேள்வியை தட்டச்சு செய்யுங்கள்:" : "Type your question:";
  const placeholder   = isZh ? "输入问题后按回车键发送..." : isMs ? "Taip soalan dan tekan Enter..." : isTa ? "கேள்வியை தட்டச்சு செய்து Enter அழுத்துங்கள்..." : undefined;
  const statusLabel   = sessionActive
    ? (isZh ? "语音会话进行中 — 请说话或输入文字" : isMs ? "Sesi suara aktif — sila bercakap atau taip" : isTa ? "குரல் அமர்வு செயலில் உள்ளது — பேசுங்கள் அல்லது தட்டச்சு செய்யுங்கள்" : "Voice session active — speak now or type below")
    : (isZh ? "开始语音会话或输入问题"            : isMs ? "Mulakan sesi suara atau taip soalan"         : isTa ? "குரல் அமர்வை தொடங்குங்கள் அல்லது கேள்வியை தட்டச்சு செய்யுங்கள்"   : "Start voice session or type below");

  const ChatPanel = () => (
    <div className="flex flex-col gap-3 w-full">
      <div className="flex items-center gap-4 p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
        <VoiceAura status={status} />
        <div className="flex-1 space-y-2">
          {/* Language toggle — disabled during active session */}
          <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5 w-fit">
              {([
                { code: "en", label: "EN"      },
                { code: "zh", label: "中文"    },
                { code: "ms", label: "BM"      },
                { code: "ta", label: "தமிழ்"  },
              ] as { code: import("@/hooks/useVoiceAgent").Language; label: string }[]).map(({ code, label }) => (
                <button key={code}
                  onClick={() => !sessionActive && onLangChange(code)}
                  disabled={sessionActive}
                  className={`px-2 py-1 rounded-md text-[10px] font-semibold transition-colors ${lang === code ? "bg-white text-blue-800 shadow-sm" : "text-slate-500 hover:text-slate-700"} disabled:cursor-not-allowed`}
                >{label}</button>
              ))}
          </div>
          <p className="text-xs text-slate-500 font-medium">{statusLabel}</p>
          <div className="flex gap-2">
            <button
              onClick={onToggleSession}
              disabled={voiceSupported === false}
              title={voiceSupported === false ? "Voice input requires Chrome or Edge" : undefined}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg font-semibold text-xs transition-all disabled:opacity-40 disabled:cursor-not-allowed ${sessionActive ? "bg-red-50 border border-red-200 text-red-700" : "bg-blue-800 text-white hover:bg-blue-900"}`}>
              {sessionActive
                ? <><MicOff size={13} />{endLabel}</>
                : <><Mic size={13} />{voiceLabel}</>}
            </button>
            <button onClick={onReset} title={resetLabel} className="p-2 rounded-lg border border-slate-200 bg-white text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors"><RotateCcw size={13} /></button>
          </div>
        </div>
      </div>
      {chatHistory.length > 0 ? <ChatBubbles history={chatHistory} /> : (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
          <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wide mb-2">Try asking:</p>
          {hints.map((h, i) => (
            <button key={i} onClick={() => onTextSend(h)} className="w-full flex items-start gap-1.5 text-slate-600 text-xs mb-1.5 text-left hover:text-blue-700 transition-colors group">
              <ChevronRight size={10} className="text-blue-400 shrink-0 mt-0.5" /><span>{h}</span>
            </button>
          ))}
        </div>
      )}
      <div><p className="text-[10px] text-slate-400 font-medium uppercase tracking-wide mb-1.5">{typeLabel}</p><TextInput onSend={onTextSend} status={status} placeholder={placeholder} /></div>
      <div className="grid grid-cols-3 gap-2">
        {[{ icon:<CheckCircle2 size={11} className="text-emerald-500"/>,label:"Resolved",value:callbackCases.filter(c=>c.status==="resolved").length,color:"text-emerald-700"},
          { icon:<Clock size={11} className="text-amber-500"/>,label:"Open",value:callbackCases.filter(c=>c.status==="open").length,color:"text-amber-700"},
          { icon:<FileText size={11} className="text-blue-500"/>,label:"Total",value:callbackCases.length,color:"text-blue-700"}].map(s=>(
          <div key={s.label} className="bg-white border border-slate-200 rounded-xl p-2.5 text-center shadow-sm">
            <div className="flex justify-center mb-1">{s.icon}</div>
            <p className={`text-base font-bold ${s.color}`}>{s.value}</p>
            <p className="text-[9px] text-slate-400 uppercase tracking-wide">{s.label}</p>
          </div>
        ))}
      </div>
    </div>
  );

  const mobileTabs = [
    { id:"chat" as const,    label:"Chat",     icon:<MessageSquare size={13}/> },
    { id:"console" as const, label:"Activity", icon:<Terminal size={13}/>,      badge:consoleLog.length },
    { id:"cases" as const,   label:"Cases",    icon:<FileText size={13}/>,       badge:callbackCases.length },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">

      {/* Unsupported browser — hard block with download links */}
      {voiceSupported === false && (
        <div className="mb-5 flex items-start gap-3 p-4 bg-amber-50 border border-amber-300 rounded-xl">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-amber-900 text-sm">
              Voice input is not supported on {browserName}
            </p>
            <p className="text-amber-700 text-xs mt-1">
              Voice features require <strong>Google Chrome</strong> or <strong>Microsoft Edge</strong> on a desktop or laptop computer.
            </p>
            <div className="flex gap-3 mt-3">
              <a href="https://www.google.com/chrome/" target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 text-white rounded-lg text-xs font-semibold hover:bg-amber-700 transition-colors">
                Download Chrome
              </a>
              <a href="https://www.microsoft.com/edge" target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-amber-300 text-amber-800 rounded-lg text-xs font-semibold hover:bg-amber-50 transition-colors">
                Download Edge
              </a>
            </div>
            <p className="text-amber-600 text-xs mt-2">
              You can still <strong>type your questions</strong> below — all ARIA features work via text on any browser.
            </p>
          </div>
        </div>
      )}

      {/* Mobile Chrome — supported but with limitations notice */}
      {voiceSupported !== false && isMobileChrome && (
        <div className="mb-5 flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-xl">
          <AlertCircle className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-blue-800 text-sm">
              Voice input on mobile may be limited
            </p>
            <p className="text-blue-700 text-xs mt-1">
              For the best voice experience, use <strong>Chrome on a desktop or laptop</strong>.
              On mobile, you can still <strong>type your questions</strong> below for full functionality.
            </p>
          </div>
        </div>
      )}

      <div className="mb-5">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-xs font-medium mb-2"><ShieldCheck className="w-3.5 h-3.5" /> Singapore Vaping Information Helpline</div>
        <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Ask ARIA</h1>
        <p className="text-slate-500 text-sm mt-1">Ask any vaping question by voice or text. Say "I need an officer callback" to log a case.</p>
      </div>
      <div className="hidden lg:grid lg:grid-cols-3 gap-5" style={{ minHeight:"calc(100vh - 260px)" }}>
        <div className="flex flex-col gap-2"><h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5"><Terminal size={11}/>Activity Log</h2><div className="flex-1 min-h-0" style={{maxHeight:"calc(100vh - 320px)"}}><ConsolePanel logs={consoleLog} onClear={clearLogs}/></div></div>
        <div className="overflow-y-auto" style={{maxHeight:"calc(100vh - 260px)"}}><ChatPanel /></div>
        <div className="flex flex-col gap-2">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5"><Phone size={11}/>Callback Cases{callbackCases.length>0&&<span className="ml-auto bg-blue-100 text-blue-700 text-[9px] font-semibold px-2 py-0.5 rounded-full">{callbackCases.length}</span>}</h2>
          <div className="flex-1 overflow-y-auto space-y-2.5 scrollbar-thin" style={{maxHeight:"calc(100vh - 320px)"}}>
            {callbackCases.length===0?(<div className="flex flex-col items-center justify-center py-12 text-slate-400 text-center"><Phone size={26} className="mb-2 opacity-30"/><p className="text-xs font-medium">No cases yet</p><p className="text-[10px] mt-1">Say "I need an officer to call me back"</p></div>):
            ([...callbackCases].reverse().map(c=>(
              <div key={c.id} className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-sm">
                <div className="flex items-start justify-between gap-2 mb-1.5"><div><div className="flex items-center gap-1.5 mb-0.5"><User size={11} className="text-slate-400"/><span className="font-semibold text-slate-800 text-xs">{c.name}</span></div><span className="font-mono text-[9px] text-slate-400">{c.id}</span></div><span className={`shrink-0 text-[9px] font-semibold px-2 py-0.5 rounded-full uppercase ${CASE_STATUS_STYLE[c.status]}`}>{c.status.replace("_"," ")}</span></div>
                <p className="text-slate-600 text-[11px] line-clamp-2">{c.query}</p>
                <div className="flex items-center gap-2 mt-1.5 text-[9px] text-slate-400"><Phone size={8}/>{c.contact}{c.callbackTime&&<><Calendar size={8}/>{c.callbackTime}</>}</div>
              </div>
            )))}
          </div>
        </div>
      </div>
      <div className="lg:hidden">
        <div className="flex border-b border-slate-200 mb-4">
          {mobileTabs.map(tab=>(
            <button key={tab.id} onClick={()=>setMobileTab(tab.id)} className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold border-b-2 transition-colors relative ${mobileTab===tab.id?"border-blue-700 text-blue-800":"border-transparent text-slate-500"}`}>
              {tab.icon}{tab.label}{tab.badge!==undefined&&tab.badge>0&&<span className="bg-blue-700 text-white text-[8px] font-bold rounded-full w-3.5 h-3.5 flex items-center justify-center">{tab.badge>9?"9+":tab.badge}</span>}
            </button>
          ))}
        </div>
        {mobileTab==="chat"&&<ChatPanel/>}
        {mobileTab==="console"&&<div className="h-[450px]"><ConsolePanel logs={consoleLog} onClear={clearLogs}/></div>}
        {mobileTab==="cases"&&<div className="space-y-3">{callbackCases.length===0?<div className="flex flex-col items-center py-14 text-slate-400 text-center"><Phone size={26} className="mb-2 opacity-30"/><p className="text-xs">No cases yet</p></div>:[...callbackCases].reverse().map(c=><div key={c.id} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm"><div className="flex justify-between gap-2 mb-1"><span className="font-semibold text-sm text-slate-800">{c.name}</span><span className={`text-[9px] font-semibold px-2 py-0.5 rounded-full uppercase ${CASE_STATUS_STYLE[c.status]}`}>{c.status.replace("_"," ")}</span></div><p className="text-slate-500 text-xs">{c.query}</p><p className="text-[10px] text-slate-400 mt-1 font-mono">{c.id}</p></div>)}</div>}
      </div>
    </div>
  );
}

// ── Track Page ────────────────────────────────────────────────────────────────
function TrackPage({ cases }: { cases: VapingCase[] }) {
  const [search, setSearch]     = useState("");
  const [caseList, setCaseList] = useState<VapingCase[]>(cases);
  const pollRef = useRef<ReturnType<typeof setInterval>|null>(null);

  // Sync when cases prop changes
  useEffect(() => { setCaseList(cases); }, [cases]);

  // Poll server every 10s to pick up officer-resolved cases (via Telegram webhook)
  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch("/api/cases");
        if (!res.ok) return;
        const data = await res.json();
        if (Array.isArray(data.cases)) setCaseList(data.cases);
      } catch {/**/}
    };
    pollRef.current = setInterval(poll, 10_000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  const filtered = caseList.filter(c =>
    c.id.toLowerCase().includes(search.toLowerCase()) ||
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.contact.includes(search)
  );

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-slate-900 mb-1">Callback Cases</h1>
        <p className="text-slate-500 text-sm">
          Track cases logged by ARIA. Cases resolved by officers via Telegram update automatically.
        </p>
      </div>

      {/* Telegram integration notice */}
      <div className="mb-5 flex items-center gap-2.5 px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-700">
        <span className="text-lg">✈️</span>
        <span>
          <strong>Telegram Integration Active</strong> — Officers receive instant alerts and can reply
          <code className="mx-1 bg-blue-100 px-1 py-0.5 rounded">/close VPG-xxx Notes here</code>
          to resolve cases remotely.
        </span>
      </div>

      <div className="relative mb-5">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
        <input type="text" placeholder="Search by case ID, name, or contact..."
          value={search} onChange={e=>setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          style={{color:"#1e293b"}}/>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-5">
        {[
          {label:"Total",    value:caseList.length,                                        color:"text-blue-700",  bg:"bg-blue-50",  border:"border-blue-200"},
          {label:"Open",     value:caseList.filter(c=>c.status==="open").length,            color:"text-amber-700", bg:"bg-amber-50", border:"border-amber-200"},
          {label:"Resolved", value:caseList.filter(c=>c.status==="resolved").length,        color:"text-green-700", bg:"bg-green-50", border:"border-green-200"},
        ].map(s=>(
          <div key={s.label} className={`${s.bg} border ${s.border} rounded-xl p-4 text-center`}>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-slate-500 uppercase tracking-wide mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {filtered.length===0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400 text-center">
          <TrendingUp size={36} className="mb-3 opacity-30"/>
          <p className="font-medium">{caseList.length===0?"No cases logged yet":"No results found"}</p>
          <p className="text-sm mt-1">{caseList.length===0?"Ask ARIA to arrange a callback":"Try a different search term"}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {[...filtered].reverse().map(c=>(
            <div key={c.id} className={`bg-white border rounded-xl p-5 shadow-sm transition-all ${c.status==="resolved" ? "border-green-300 bg-green-50/30" : "border-slate-200"}`}>
              <div className="flex items-start justify-between gap-4 mb-3">
                <div>
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <User size={13} className="text-slate-400"/>
                    <span className="font-semibold text-slate-800">{c.name}</span>
                    <span className="font-mono text-xs text-slate-400">{c.id}</span>
                    {/* Telegram badge */}
                    <span className="inline-flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700">
                      ✈️ Telegram
                    </span>
                    {c.status==="resolved" && (
                      <span className="inline-flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-green-100 text-green-700">
                        ✅ Officer Closed
                      </span>
                    )}
                  </div>
                  <p className="text-slate-600 text-sm">{c.query}</p>
                </div>
                <span className={`shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full uppercase ${CASE_STATUS_STYLE[c.status]}`}>
                  {c.status.replace("_"," ")}
                </span>
              </div>
              <div className="grid sm:grid-cols-2 gap-2 border-t border-slate-100 pt-3 text-sm text-slate-600">
                <div className="flex items-center gap-2"><Phone size={12} className="text-slate-400"/>{c.contact}</div>
                {c.email&&<div className="flex items-center gap-2"><Mail size={12} className="text-slate-400"/>{c.email}</div>}
                {c.callbackTime&&<div className="flex items-center gap-2"><Calendar size={12} className="text-slate-400"/>Callback: {c.callbackTime}</div>}
                <div className="flex items-center gap-2"><Clock size={12} className="text-slate-400"/>{new Date(c.createdAt).toLocaleString()}</div>
                {c.resolvedAt&&<div className="flex items-center gap-2 text-green-600"><CheckCircle2 size={12}/>Resolved: {new Date(c.resolvedAt).toLocaleString()}</div>}
              </div>
              {c.notes&&<div className="mt-3 bg-white rounded-lg p-3 text-xs text-slate-600 border border-slate-200">{c.notes}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Laws & Penalties Page ────────────────────────────────────────────────────
function LawsPage({ onNav }: { onNav: (p: NavPage) => void }) {
  const penalties = [
    { tier: "First Offence", offence: "Use or Possession", fine: "Up to SGD 2,000", jail: "—", icon: <AlertTriangle size={16} className="text-amber-500" /> },
    { tier: "Repeat Offence", offence: "Use or Possession", fine: "Up to SGD 4,000", jail: "—", icon: <BadgeAlert size={16} className="text-orange-500" /> },
    { tier: "Any Offence", offence: "Importation", fine: "Up to SGD 10,000", jail: "Up to 6 months", icon: <Gavel size={16} className="text-red-500" /> },
    { tier: "Repeat Importation", offence: "Importation", fine: "Up to SGD 20,000", jail: "Up to 12 months", icon: <Gavel size={16} className="text-red-700" /> },
    { tier: "Any Offence", offence: "Sale or Distribution", fine: "Up to SGD 10,000", jail: "Up to 6 months", icon: <Gavel size={16} className="text-red-500" /> },
    { tier: "Sale to Under-21", offence: "Sale to Minors", fine: "Up to SGD 20,000", jail: "—", icon: <ShieldCheck size={16} className="text-red-700" /> },
  ];
  const prohibited = [
    "Using or possessing any e-cigarette or vaping device",
    "Importing vaping devices — even for personal use",
    "Selling or distributing vaping products",
    "Advertising vaping products in any form",
    "Bringing vaping devices into Singapore as a tourist",
    "Using heated tobacco products such as IQOS or glo",
    "Vaping in all public places, air-conditioned premises and food establishments",
  ];
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-xs font-medium mb-3"><Shield className="w-3.5 h-3.5" /> Singapore Tobacco Act (Cap 309)</div>
        <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Laws & Penalties</h1>
        <p className="text-slate-500 text-sm mt-1">Vaping is illegal in Singapore under the Tobacco (Control of Advertisements and Sale) Act. Here is what you need to know.</p>
      </div>

      {/* Alert banner */}
      <div className="mb-6 flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
        <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold text-red-900 text-sm">Vaping is illegal in Singapore</p>
          <p className="text-red-700 text-xs mt-1">This includes e-cigarettes, vaporisers, heated tobacco products (IQOS, glo, Ploom), and all related accessories — regardless of nicotine content.</p>
        </div>
      </div>

      {/* Prohibited activities */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm mb-6">
        <h2 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><Lock size={16} className="text-red-500" />What is Prohibited</h2>
        <div className="space-y-2">
          {prohibited.map((item, i) => (
            <div key={i} className="flex items-start gap-2.5 text-sm text-slate-700">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0 mt-2" />
              {item}
            </div>
          ))}
        </div>
      </div>

      {/* Penalty table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm mb-6">
        <div className="px-5 py-4 border-b border-slate-200 bg-slate-50">
          <h2 className="font-bold text-slate-800 flex items-center gap-2"><Gavel size={16} className="text-blue-600" />Penalty Schedule</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-slate-200 bg-slate-50/50">
              <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Offence Type</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Maximum Fine</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Imprisonment</th>
            </tr></thead>
            <tbody>
              {penalties.map((p, i) => (
                <tr key={i} className={`border-b border-slate-100 ${i % 2 === 0 ? "" : "bg-slate-50/30"}`}>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">{p.icon}<div><p className="font-medium text-slate-800">{p.offence}</p><p className="text-xs text-slate-400">{p.tier}</p></div></div>
                  </td>
                  <td className="px-5 py-3 font-semibold text-red-700">{p.fine}</td>
                  <td className="px-5 py-3 text-slate-600">{p.jail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Enforcement agencies */}
      <div className="grid sm:grid-cols-3 gap-4 mb-6">
        {[
          { name:"Health Sciences Authority (HSA)", role:"Primary regulator — vaping devices and importation", tel:"1800-117-8333", color:"bg-blue-50 border-blue-200" },
          { name:"National Environment Agency (NEA)", role:"Smoking prohibition in public places", tel:"1800-225-5632", color:"bg-green-50 border-green-200" },
          { name:"Singapore Police Force (SPF)", role:"Serious offences — minors and distribution", tel:"999", color:"bg-red-50 border-red-200" },
        ].map((a, i) => (
          <div key={i} className={`border rounded-xl p-4 ${a.color}`}>
            <p className="font-semibold text-slate-800 text-xs mb-1">{a.name}</p>
            <p className="text-slate-500 text-xs mb-2">{a.role}</p>
            <a href={`tel:${a.tel}`} className="text-blue-700 text-xs font-semibold">📞 {a.tel}</a>
          </div>
        ))}
      </div>

      <div className="flex gap-3">
        <button onClick={() => onNav("assistant")} className="flex items-center gap-2 px-5 py-2.5 bg-blue-800 text-white rounded-lg text-sm font-semibold hover:bg-blue-900 transition-colors">
          <MessageSquare size={14} /> Ask ARIA a Question
        </button>
        <a href="https://sso.agc.gov.sg/Act/TCASA1993" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-5 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-50 transition-colors">
          <ExternalLink size={14} /> View Full Act
        </a>
      </div>
    </div>
  );
}

// ── Health Risks Page ─────────────────────────────────────────────────────────
function HealthPage({ onNav }: { onNav: (p: NavPage) => void }) {
  const shortTerm = [
    { title: "Throat & Airway Irritation", desc: "Immediate coughing, wheezing, and throat soreness from chemical vapour inhalation." },
    { title: "Elevated Heart Rate", desc: "Nicotine causes rapid heart rate and increased blood pressure within minutes of use." },
    { title: "Dizziness & Headaches", desc: "Nicotine absorption causes dizziness, nausea, and headaches especially in new users." },
    { title: "Dry Mouth & Dehydration", desc: "Propylene glycol in e-liquids draws moisture from mouth tissues." },
  ];
  const longTerm = [
    { title: "EVALI — Lung Injury", desc: "E-cigarette or Vaping product use-Associated Lung Injury causes serious, potentially fatal lung damage. Over 2,800 cases hospitalised in the US alone.", severity: "critical" },
    { title: "Nicotine Addiction", desc: "Most e-liquids contain highly addictive nicotine. Adolescent brains are especially vulnerable — addiction can develop within days.", severity: "high" },
    { title: "Cardiovascular Disease", desc: "Long-term vaping raises risk of heart attack, stroke, and arterial damage comparable to tobacco cigarettes.", severity: "high" },
    { title: "Brain Development Harm", desc: "Nicotine permanently impairs memory, attention, and impulse control in adolescents under 25.", severity: "high" },
    { title: "Respiratory Disease", desc: "Chronic bronchitis, reduced lung capacity, and increased asthma severity in long-term users.", severity: "medium" },
    { title: "Chemical Exposure", desc: "E-liquid aerosol contains formaldehyde, acrolein, and heavy metals — all known carcinogens.", severity: "medium" },
  ];
  const severityConfig: Record<string, string> = {
    critical: "bg-red-100 border-red-300 text-red-800",
    high:     "bg-orange-50 border-orange-200 text-orange-800",
    medium:   "bg-amber-50 border-amber-200 text-amber-800",
  };
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-orange-50 text-orange-700 border border-orange-200 text-xs font-medium mb-3"><HeartPulse className="w-3.5 h-3.5" /> Health Sciences Authority Singapore</div>
        <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Health Risks of Vaping</h1>
        <p className="text-slate-500 text-sm mt-1">Vaping is not safe. Contrary to popular belief, e-cigarettes cause serious short and long-term health harm.</p>
      </div>

      {/* Myth vs fact */}
      <div className="mb-6 grid sm:grid-cols-2 gap-4">
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-xs font-bold text-red-600 uppercase tracking-wide mb-2">❌ Common Myth</p>
          <p className="text-slate-800 text-sm font-medium">"Vaping is just water vapour — it's harmless"</p>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <p className="text-xs font-bold text-green-600 uppercase tracking-wide mb-2">✅ The Fact</p>
          <p className="text-slate-800 text-sm font-medium">Aerosol contains toxic chemicals, heavy metals, and ultrafine particles that penetrate deep into the lungs.</p>
        </div>
      </div>

      {/* Short term */}
      <div className="mb-6">
        <h2 className="font-bold text-slate-800 mb-3 flex items-center gap-2"><Activity size={16} className="text-amber-500" />Short-Term Effects</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          {shortTerm.map((e, i) => (
            <div key={i} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
              <p className="font-semibold text-slate-800 text-sm mb-1">{e.title}</p>
              <p className="text-slate-500 text-xs leading-relaxed">{e.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Long term */}
      <div className="mb-6">
        <h2 className="font-bold text-slate-800 mb-3 flex items-center gap-2"><HeartPulse size={16} className="text-red-500" />Long-Term Effects</h2>
        <div className="space-y-3">
          {longTerm.map((e, i) => (
            <div key={i} className={`border rounded-xl p-4 ${severityConfig[e.severity]}`}>
              <p className="font-semibold text-sm mb-1">{e.title}</p>
              <p className="text-xs leading-relaxed opacity-80">{e.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Quit resources */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 mb-6">
        <h2 className="font-bold text-blue-900 mb-3 flex items-center gap-2"><Heart size={15} className="text-blue-600" />Want to Quit Vaping?</h2>
        <div className="grid sm:grid-cols-2 gap-3 text-sm">
          <div><p className="font-semibold text-blue-800">HPB QuitLine</p><a href="tel:18004382000" className="text-blue-600 font-semibold">1800-438-2000</a><p className="text-blue-700 text-xs mt-0.5">Free counselling, Mon–Fri 8am–8pm</p></div>
          <div><p className="font-semibold text-blue-800">I Quit Programme</p><a href="https://heartbeat.health.gov.sg" target="_blank" rel="noopener noreferrer" className="text-blue-600 font-semibold flex items-center gap-1">heartbeat.health.gov.sg <ExternalLink size={10} /></a><p className="text-blue-700 text-xs mt-0.5">Free cessation programme, medication support</p></div>
        </div>
      </div>

      <div className="flex gap-3">
        <button onClick={() => onNav("assistant")} className="flex items-center gap-2 px-5 py-2.5 bg-blue-800 text-white rounded-lg text-sm font-semibold hover:bg-blue-900 transition-colors">
          <MessageSquare size={14} /> Ask ARIA a Question
        </button>
        <a href="https://www.hsa.gov.sg/e-cigarettes" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-5 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-50 transition-colors">
          <ExternalLink size={14} /> HSA Health Info
        </a>
      </div>
    </div>
  );
}

// ── Surrender Page ────────────────────────────────────────────────────────────
function SurrenderPage({ onNav }: { onNav: (p: NavPage) => void }) {
  const centres = [
    { name: "HSA Enforcement Branch (HQ)", address: "11 Biopolis Way, Helios, Singapore 138667", area: "one-north", mapsUrl: "https://maps.google.com/?q=11+Biopolis+Way+Singapore", hours: "Mon–Fri: 8:30am – 5:30pm", note: "Main surrender centre. Walk-in accepted." },
    { name: "Police Coast Guard — Tuas", address: "51 Tuas South Avenue 1, Singapore 637501", area: "West", mapsUrl: "https://maps.google.com/?q=51+Tuas+South+Avenue+1+Singapore", hours: "Mon–Fri: 9:00am – 5:00pm", note: "For devices seized at Tuas Checkpoint." },
    { name: "Woodlands Checkpoint — Singapore Customs", address: "21 Woodlands Crossing, Singapore 738233", area: "North", mapsUrl: "https://maps.google.com/?q=21+Woodlands+Crossing+Singapore", hours: "24 hours, 7 days", note: "Devices may be surrendered at point of entry." },
    { name: "Changi Airport — Singapore Customs T1", address: "Terminal 1, Changi Airport, Singapore 819642", area: "East", mapsUrl: "https://maps.google.com/?q=Changi+Airport+Terminal+1+Singapore", hours: "24 hours, 7 days", note: "Arriving passengers may surrender at Customs." },
    { name: "Changi Airport — Singapore Customs T2/T3", address: "Terminal 2 & 3, Changi Airport, Singapore", area: "East", mapsUrl: "https://maps.google.com/?q=Changi+Airport+Terminal+2+Singapore", hours: "24 hours, 7 days", note: "Arriving passengers may surrender at Customs." },
  ];

  const steps = [
    { step: "1", title: "Do not use or show the device", desc: "Do not vape in public or display the device. Carry it concealed in your bag." },
    { step: "2", title: "Visit the nearest surrender centre", desc: "Walk into any HSA Enforcement Branch, Police Post, or Singapore Customs checkpoint." },
    { step: "3", title: "Declare your device voluntarily", desc: "Inform the officer you wish to surrender a vaping device voluntarily. This is different from being caught." },
    { step: "4", title: "Complete a simple form", desc: "You will be asked to fill in a short surrender declaration form. No NRIC required for voluntary surrender." },
    { step: "5", title: "Device is confiscated and destroyed", desc: "The device is logged and destroyed. You receive a surrender acknowledgement slip." },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-xs font-medium mb-3"><MapPin className="w-3.5 h-3.5" /> Voluntary Surrender Programme</div>
        <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Surrender Your Vaping Device</h1>
        <p className="text-slate-500 text-sm mt-1">If you have a vaping device, surrender it voluntarily. Voluntary surrender is treated more leniently than being caught in possession.</p>
      </div>

      {/* Voluntary vs caught */}
      <div className="grid sm:grid-cols-2 gap-4 mb-6">
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <p className="text-xs font-bold text-green-600 uppercase tracking-wide mb-2">✅ Voluntary Surrender</p>
          <ul className="space-y-1 text-xs text-green-800">
            <li>• No fine in most cases</li>
            <li>• No criminal record</li>
            <li>• Simple acknowledgement form only</li>
            <li>• Walk-in, no appointment needed</li>
          </ul>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-xs font-bold text-red-600 uppercase tracking-wide mb-2">❌ If Caught in Possession</p>
          <ul className="space-y-1 text-xs text-red-800">
            <li>• Fine up to SGD 2,000 (first offence)</li>
            <li>• Fine up to SGD 4,000 (repeat)</li>
            <li>• Enforcement record created</li>
            <li>• Possible court proceedings</li>
          </ul>
        </div>
      </div>

      {/* Steps */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm mb-6">
        <h2 className="font-bold text-slate-800 mb-5 flex items-center gap-2"><CheckCircle2 size={16} className="text-green-500" />How to Surrender — Step by Step</h2>
        <div className="space-y-4">
          {steps.map((s, i) => (
            <div key={i} className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-blue-800 text-white flex items-center justify-center text-xs font-bold shrink-0">{s.step}</div>
              <div className="flex-1 pb-4 border-b border-slate-100 last:border-0 last:pb-0">
                <p className="font-semibold text-slate-800 text-sm">{s.title}</p>
                <p className="text-slate-500 text-xs mt-0.5 leading-relaxed">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Surrender centres */}
      <div className="mb-6">
        <h2 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><MapPin size={16} className="text-blue-600" />Authorised Surrender Centres</h2>
        <div className="space-y-3">
          {centres.map((c, i) => (
            <div key={i} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-semibold text-slate-800 text-sm">{c.name}</p>
                    <span className="text-[10px] bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full font-medium">{c.area}</span>
                  </div>
                  <p className="text-slate-500 text-xs flex items-center gap-1 mb-1"><MapPin size={10} />{c.address}</p>
                  <p className="text-slate-500 text-xs flex items-center gap-1 mb-1"><Clock size={10} />{c.hours}</p>
                  <p className="text-emerald-600 text-xs font-medium">{c.note}</p>
                </div>
                <a href={c.mapsUrl} target="_blank" rel="noopener noreferrer"
                  className="shrink-0 flex items-center gap-1.5 px-3 py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg text-xs font-semibold hover:bg-blue-100 transition-colors">
                  <Navigation2 size={12} /> Maps
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Surrender centres map links */}
      <div className="mb-6 bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
          <p className="text-xs font-semibold text-slate-600 flex items-center gap-1.5"><MapPin size={12} className="text-blue-600" />Quick Directions — Click to Open in Google Maps</p>
        </div>
        <div className="p-4 grid sm:grid-cols-2 gap-3">
          {centres.map((c, i) => (
            <a key={i} href={c.mapsUrl} target="_blank" rel="noopener noreferrer"
              className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 hover:border-blue-300 hover:bg-blue-50 transition-colors group">
              <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                <Navigation2 size={14} className="text-blue-700" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-800 text-xs leading-snug">{c.name}</p>
                <p className="text-slate-400 text-[10px] mt-0.5 truncate">{c.address}</p>
                <p className="text-blue-600 text-[10px] font-semibold mt-1 group-hover:underline">Open in Google Maps →</p>
              </div>
            </a>
          ))}
        </div>
      </div>

      {/* Google Maps embed — requires NEXT_PUBLIC_GOOGLE_MAPS_KEY in Vercel env vars */}
      {process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY && (
        <div className="mb-6 bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
            <p className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
              <MapPin size={12} className="text-blue-600" />HSA Enforcement Branch — Main Surrender Centre
            </p>
          </div>
          <iframe
            title="HSA Enforcement Branch Location"
            width="100%"
            height="300"
            style={{ border: 0 }}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            src={`https://www.google.com/maps/embed/v1/place?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY}&q=HSA+Health+Sciences+Authority+11+Biopolis+Way+Singapore`}
          />
        </div>
      )}

      {/* HSA hotline */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 flex items-center gap-4">
        <Phone className="w-8 h-8 text-blue-600 shrink-0" />
        <div>
          <p className="font-semibold text-blue-900">HSA Vaping Hotline</p>
          <a href="tel:18001178333" className="text-blue-700 font-bold text-lg">1800-117-8333</a>
          <p className="text-blue-600 text-xs mt-0.5">Monday – Friday, 8:30am – 5:30pm. Call to confirm surrender procedures before visiting.</p>
        </div>
      </div>

      <div className="flex gap-3">
        <button onClick={() => onNav("assistant")} className="flex items-center gap-2 px-5 py-2.5 bg-blue-800 text-white rounded-lg text-sm font-semibold hover:bg-blue-900 transition-colors">
          <MessageSquare size={14} /> Ask ARIA a Question
        </button>
        <a href="https://www.hsa.gov.sg" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-5 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-50 transition-colors">
          <ExternalLink size={14} /> Visit HSA Website
        </a>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function Page() {
  const { status, consoleLog, callbackCases, lookedUpCases, chatHistory, startSession, stopSession, clearLogs, resetConversation, sendTextQuery } = useVoiceAgent();
  const [sessionActive, setSessionActive] = useState(false);
  const [page, setPage] = useState<NavPage>("home");
  const [lang, setLang] = useState<Language>("en");

  const handleToggleSession = () => {
    if (sessionActive) { stopSession(); setSessionActive(false); }
    else { startSession(lang); setSessionActive(true); }
  };

  const handleLangChange = (l: Language) => {
    if (sessionActive) return; // cannot switch during active session
    setLang(l);
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        body{font-family:'Inter',sans-serif;}
        @keyframes spin-slow{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        .animate-spin-slow{animation:spin-slow 3s linear infinite;}
        .scrollbar-thin::-webkit-scrollbar{width:4px;}
        .scrollbar-thumb-slate::-webkit-scrollbar-thumb{background:#cbd5e1;border-radius:2px;}
        .scrollbar-track-transparent::-webkit-scrollbar-track{background:transparent;}
      `}</style>
      <div className="min-h-screen bg-slate-50">
        <Navigation page={page} onNav={setPage} />
        {page==="home"      && <HomePage onNav={setPage} />}
        {page==="assistant" && <AssistantPage status={status} consoleLog={consoleLog} callbackCases={callbackCases} chatHistory={chatHistory} sessionActive={sessionActive} onToggleSession={handleToggleSession} clearLogs={clearLogs} onReset={resetConversation} onTextSend={sendTextQuery} lang={lang} onLangChange={handleLangChange} />}
        {page==="laws"      && <LawsPage onNav={setPage} />}
        {page==="health"    && <HealthPage onNav={setPage} />}
        {page==="surrender" && <SurrenderPage onNav={setPage} />}
        {page==="faq"       && <FAQPage />}
        {page==="offender"  && <OffenderPage lookedUpCases={lookedUpCases} onTextSend={sendTextQuery} status={status} chatHistory={chatHistory} />}
        {page==="track"     && <TrackPage cases={callbackCases} />}
      </div>
    </>
  );
}
