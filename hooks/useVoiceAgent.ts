"use client";
// hooks/useVoiceAgent.ts — ARIA v5.0
// Stable voice for 20+ min sessions:
// - aborted errors silently ignored (no loop)
// - SR auto-restarts every 50s (before Chrome 60s timeout)
// - Heartbeat watchdog revives dead SR
// - Exponential backoff on retries
// - Chinese text uses browser zh-CN TTS, English uses ElevenLabs

import { useState, useRef, useCallback, useEffect } from "react";

export type Language    = "en" | "zh" | "ms" | "ta";
export type AgentStatus = "idle" | "listening" | "thinking" | "speaking" | "error";

export interface ConsoleEntry {
  id: string; timestamp: string;
  type: "think"|"action"|"result"|"speak"|"listen"|"error"|"system";
  message: string;
}
export interface VapingCase {
  id: string; name: string; contact: string; email?: string; query: string;
  callbackTime?: string; status: "open"|"in_progress"|"resolved";
  createdAt: string; resolvedAt?: string; notes?: string;
}
export interface OffenderCase {
  caseRef: string; nric: string; name: string; age: number;
  offenceType: string; offenceDate: string; location: string; description: string;
  penaltyTier: 1|2|3;
  penalties: {
    fine?: { amount: number; currency: string; dueDate: string; paid: boolean };
    rehabilitation?: { programme: string; sessions: number; startDate: string; completedSessions: number; status: string };
    jailTerm?: { duration: string; facility: string; startDate: string; releaseDate: string; status: string };
  };
  status: string; caseOfficer: string; courtDate?: string; nextAction: string;
  timeline: Array<{ date: string; event: string; completed: boolean }>;
}
export interface ActionLogEntry { tool: string; input: object; output: object; }

const TOOL_LABELS: Record<string,string> = {
  search_vaping_info:   "Searching Singapore vaping regulations",
  lookup_offender_case: "Looking up enforcement case",
  log_callback_case:    "Logging callback case",
  get_case_status:      "Retrieving callback case status",
};

function stripMd(t: string): string {
  return t
    .replace(/\*\*(.+?)\*\*/g,"$1").replace(/\*(.+?)\*/g,"$1")
    .replace(/`(.+?)`/g,"$1").replace(/#{1,6}\s+/g,"")
    .replace(/\[(.+?)\]\(.+?\)/g,"$1").replace(/^\s*[-*+]\s+/gm,"")
    .replace(/^\s*\d+\.\s+/gm,"").replace(/_{1,2}(.+?)_{1,2}/g,"$1")
    .replace(/>\s+/g,"").trim();
}
function ts()  { return new Date().toLocaleTimeString("en-US",{hour12:false}); }
function uid() { return Math.random().toString(36).slice(2,9); }
function isChinese(t: string) { return /[\u4e00-\u9fff]/.test(t); }
function isTamil(t: string)   { return /[\u0B80-\u0BFF]/.test(t); } // Tamil Unicode block

const NOISE = new Set([
  "","hmm","um","uh","ah","oh",
  "and i can","and i","i can","you can",
]);
function isNoise(text: string, conf: number) {
  const t = text.trim().toLowerCase();
  // Only filter: empty, very low confidence, or known echo phrases
  // Do NOT filter short words like "yes", "no", "hi" — these may be real answers
  return t.length < 2 || conf < 0.15 || NOISE.has(t);
}

// ── SR_LIFETIME: restart SR after this many ms to beat Chrome's 60s timeout ──
const SR_LIFETIME_MS = 50_000; // 50 seconds

export function useVoiceAgent() {
  const [status,         setStatus]         = useState<AgentStatus>("idle");
  const [consoleLog,     setConsoleLog]      = useState<ConsoleEntry[]>([
    {id:uid(),timestamp:ts(),type:"system",message:"ARIA v5.0.0 — Production-Stable Voice Assistant ready."},
    {id:uid(),timestamp:ts(),type:"system",message:"Capabilities: Vaping info, offender case lookup, callback case logging, FAQ generation."},
    {id:uid(),timestamp:ts(),type:"system",message:"Use voice or type your question at any time."},
  ]);
  const [callbackCases,  setCallbackCases]  = useState<VapingCase[]>([]);
  const [lookedUpCases,  setLookedUpCases]  = useState<OffenderCase[]>([]);
  const [chatHistory,    setChatHistory]    = useState<Array<{role:"user"|"aria";text:string}>>([]);

  // ── Refs ────────────────────────────────────────────────────────────────────
  const historyRef    = useRef<object[]>([]);
  const processingRef = useRef(false);
  const listeningRef  = useRef(false);
  const activeRef     = useRef(false);
  const langRef       = useRef<Language>("en");
  const noSpeechRef   = useRef(0);
  const backoffRef    = useRef(300);          // ms, doubles on each no-speech
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const srRef         = useRef<any>(null); // eslint-disable-line @typescript-eslint/no-explicit-any
  const audioRef      = useRef<HTMLAudioElement|null>(null);
  const queueRef      = useRef<string[]>([]);
  const speakingRef   = useRef(false);     // true while TTS is playing
  const srTimerRef    = useRef<ReturnType<typeof setTimeout>|null>(null); // 50s restart timer
  const watchdogRef   = useRef<ReturnType<typeof setInterval>|null>(null);// heartbeat
  const lastSrEventRef = useRef<number>(0); // timestamp of last SR event

  // Stable function refs — SR callbacks always read latest version
  const openMicRef       = useRef<()=>void>(()=>{});
  const processInputRef  = useRef<(s:string)=>void>(()=>{});

  const addLog  = useCallback((type:ConsoleEntry["type"],msg:string) => {
    setConsoleLog(p=>[...p,{id:uid(),timestamp:ts(),type,message:msg}]);
  },[]);
  const addChat = useCallback((role:"user"|"aria",text:string) => {
    setChatHistory(p=>[...p,{role,text:stripMd(text)}]);
  },[]);

  // ── TTS: browser (used for Chinese + fallback) ───────────────────────────
  const speakBrowser = useCallback((text:string, lang?:string):Promise<void> => new Promise(resolve => {
    if (!("speechSynthesis" in window)) { resolve(); return; }
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(stripMd(text));
    u.rate = 1.0; u.pitch = 1.0;
    const voices = window.speechSynthesis.getVoices();
    if (lang === "zh") {
      const v = voices.find(v=>v.lang==="zh-CN") ?? voices.find(v=>v.lang.startsWith("zh"));
      if (v) u.voice = v;
      u.lang = "zh-CN";
    } else if (lang === "ms") {
      const v = voices.find(v=>v.lang==="ms-MY") ?? voices.find(v=>v.lang.startsWith("ms"));
      if (v) u.voice = v;
      u.lang = "ms-MY";
    } else if (lang === "ta") {
      const v = voices.find(v=>v.lang==="ta-IN") ?? voices.find(v=>v.lang.startsWith("ta"));
      if (v) u.voice = v;
      u.lang = "ta-IN";
    } else {
      const v = voices.find(v=>v.name.includes("Samantha")||v.lang==="en-US");
      if (v) u.voice = v;
      u.lang = "en-US";
    }
    u.onend = ()=>resolve(); u.onerror = ()=>resolve();
    window.speechSynthesis.speak(u);
  }),[]);

  // ── TTS: ElevenLabs for English, browser for Chinese ────────────────────
  const speak = useCallback(async (text:string):Promise<void> => {
    const clean = stripMd(text);
    const currentLang = langRef.current;
    speakingRef.current = true;
    try {
      // Chinese, Malay, and Tamil always use browser TTS
      // ElevenLabs English voice cannot pronounce these languages
      if (isChinese(clean) || currentLang === "zh") {
        await speakBrowser(clean, "zh"); speakingRef.current = false; return;
      }
      if (isTamil(clean) || currentLang === "ta") {
        await speakBrowser(clean, "ta"); speakingRef.current = false; return;
      }
      if (currentLang === "ms") {
        await speakBrowser(clean, "ms"); speakingRef.current = false; return;
      }
      // English — use ElevenLabs if available
      const key = process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY;
      if (!key) { await speakBrowser(clean); speakingRef.current = false; return; }
      try {
        const ctrl = new AbortController();
        const t = setTimeout(()=>ctrl.abort(), 8000);
        const res = await fetch("https://api.elevenlabs.io/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM/stream",{
          method:"POST", signal:ctrl.signal,
          headers:{"Content-Type":"application/json","xi-api-key":key},
          body:JSON.stringify({text:clean,model_id:"eleven_turbo_v2",
            voice_settings:{stability:0.5,similarity_boost:0.85,style:0.2,use_speaker_boost:true}}),
        });
        clearTimeout(t);
        if (!res.ok) { await speakBrowser(clean); speakingRef.current = false; return; }
        const url = URL.createObjectURL(await res.blob());
        await new Promise<void>(resolve=>{
          if (audioRef.current){audioRef.current.pause();URL.revokeObjectURL(audioRef.current.src);}
          const a = new Audio(url); audioRef.current = a;
          const done = ()=>{URL.revokeObjectURL(url);resolve();};
          a.onended=done; a.onerror=done; a.play().catch(async()=>{done(); await speakBrowser(clean);});
        });
      } catch { await speakBrowser(clean); }
    } finally {
      speakingRef.current = false;
    }
  },[speakBrowser]);

  // ── Stop SR cleanly ──────────────────────────────────────────────────────
  const stopSR = useCallback(() => {
    if (srTimerRef.current) { clearTimeout(srTimerRef.current); srTimerRef.current = null; }
    if (srRef.current) {
      try { srRef.current.onstart=null; srRef.current.onresult=null;
            srRef.current.onerror=null; srRef.current.onend=null;
            srRef.current.stop(); } catch {/**/}
      srRef.current = null;
    }
    listeningRef.current = false;
  },[]);

  // ── openMic: the ONLY place SR is started ───────────────────────────────
  const openMicFn = useCallback(() => {
    // Hard guards — only one of these conditions needs to be true to block
    if (!activeRef.current)    return;
    if (listeningRef.current)  return;
    if (processingRef.current) return;

    // Stop any lingering SR instance (no-op if already null)
    stopSR();

    // Pause audio output before opening mic — prevents echo
    if (audioRef.current && !audioRef.current.paused) audioRef.current.pause();
    window.speechSynthesis?.cancel();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SR) { addLog("error","[MIC] Use Chrome or Edge for voice support."); return; }

    const r = new SR();
    r.lang = langRef.current === "zh" ? "zh-CN"
           : langRef.current === "ms" ? "ms-MY"
           : langRef.current === "ta" ? "ta-IN"
           : "en-US";
    r.interimResults  = false;
    r.maxAlternatives = 1;
    r.continuous      = false;

    r.onstart = () => {
      listeningRef.current  = true;
      noSpeechRef.current   = 0;
      backoffRef.current    = 300;
      lastSrEventRef.current = Date.now();
      setStatus("listening");
      addLog("listen","[MIC] Listening...");

      // Schedule auto-restart before Chrome's 60s timeout
      srTimerRef.current = setTimeout(() => {
        if (activeRef.current && listeningRef.current && !processingRef.current) {
          addLog("system","[MIC] Auto-restarting SR (50s limit)...");
          stopSR();
          setTimeout(() => openMicRef.current(), 200);
        }
      }, SR_LIFETIME_MS);
    };

    r.onresult = (e: Event) => {
      lastSrEventRef.current = Date.now();
      noSpeechRef.current = 0; // reset silence counter on any speech
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = (e as any).results[0][0];
      const text: string = result.transcript ?? "";
      const conf: number = result.confidence ?? 1;

      // Discard if TTS is still playing — this is echo from the speaker
      if (speakingRef.current) {
        addLog("system",`[MIC] Echo discarded during TTS: "${text}"`);
        stopSR();
        setTimeout(() => openMicRef.current(), 600);
        return;
      }

      stopSR(); // clean stop before processing

      if (isNoise(text, conf)) {
        addLog("system",`[MIC] Ignored: "${text}" (conf:${conf.toFixed(2)})`);
        setTimeout(() => openMicRef.current(), 400);
        return;
      }
      processInputRef.current(text);
    };

    r.onerror = (e: Event) => {
      lastSrEventRef.current = Date.now();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const err = (e as any).error;

      // aborted = we stopped it ourselves — silently ignore, no action
      if (err === "aborted") return;

      stopSR();

      if (err === "no-speech") {
        // Don't count no-speech while TTS is playing — expected silence
        if (speakingRef.current) {
          setTimeout(() => openMicRef.current(), 500);
          return;
        }
        noSpeechRef.current += 1;
        if (noSpeechRef.current > 12) {
          // Too many silent retries — pause session
          noSpeechRef.current = 0;
          activeRef.current = false;
          setStatus("idle");
          addLog("system","[MIC] No speech detected — session paused. Tap Start to resume.");
          return;
        }
        // Exponential backoff: 300→600→1200→2400ms, max 4s
        const delay = Math.min(backoffRef.current, 4000);
        backoffRef.current = Math.min(backoffRef.current * 2, 4000);
        setTimeout(() => openMicRef.current(), delay);

      } else if (err === "not-allowed" || err === "permission-denied") {
        addLog("error","[MIC] Permission denied. Allow microphone in browser settings.");
        setStatus("error");
        activeRef.current = false;

      } else {
        // Other errors: log but don't retry automatically to avoid loops
        addLog("error",`[MIC] Error: ${err}`);
      }
    };

    r.onend = () => {
      // onend fires after stop() — just clean up, never reopen from here
      listeningRef.current = false;
      srRef.current = null;
    };

    srRef.current = r;
    try {
      r.start();
    } catch {
      listeningRef.current = false;
      srRef.current = null;
    }
  },[addLog, stopSR]);

  useEffect(() => { openMicRef.current = openMicFn; }, [openMicFn]);

  // ── processInput ─────────────────────────────────────────────────────────
  const processInputFn = useCallback(async (input: string) => {
    if (processingRef.current) {
      queueRef.current.push(input);
      addLog("system",`[QUEUE] "${input}"`);
      return;
    }
    stopSR();
    processingRef.current = true;
    setStatus("thinking");
    addChat("user", input);
    addLog("listen",`[USER] "${input}"`);

    let reply = "I encountered an error. Please try again.";
    try {
      const res = await fetch("/api/agent",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({transcript:input, conversationHistory:historyRef.current}),
      });
      const data = await res.json();

      if (data.actionLog?.length) {
        for (const e of data.actionLog as ActionLogEntry[]) {
          addLog("action",`[TOOL] ${e.tool} → ${TOOL_LABELS[e.tool]??e.tool}`);
          const out = e.output as Record<string,unknown>;
          if (out.success===false) addLog("error",`[FAIL] ${out.error??"error"}`);
          else addLog("result",`[OK] ${out.message??out.summary??"[Done]"}`);
        }
      }
      if (data.newCases?.length) {
        setCallbackCases(p=>[...p,...data.newCases]);
        for (const c of data.newCases as VapingCase[]) addLog("result",`[CASE] ${c.id} — ${c.name}`);
      }
      if (data.offenderResults?.length) {
        setLookedUpCases(p=>{
          const seen = new Set(p.map(c=>c.caseRef));
          return [...p,...(data.offenderResults as OffenderCase[]).filter(c=>!seen.has(c.caseRef))];
        });
        for (const c of data.offenderResults as OffenderCase[]) addLog("result",`[LOOKUP] ${c.caseRef} — ${c.name}`);
      }
      if (Array.isArray(data.updatedHistory)) historyRef.current = data.updatedHistory;
      reply = stripMd(data.response ?? reply);
    } catch(err) {
      addLog("error",`[ERROR] ${err instanceof Error?err.message:String(err)}`);
    }

    addChat("aria", reply);
    addLog("speak",`[ARIA] ${reply}`);
    setStatus("speaking");
    await speak(reply);

    processingRef.current = false;

    if (queueRef.current.length > 0) {
      const next = queueRef.current.shift()!;
      setTimeout(() => processInputRef.current(next), 200);
    } else if (activeRef.current) {
      // Poll until mic opens successfully — handles edge cases
      let tries = 0;
      const tryOpen = () => {
        if (!activeRef.current || listeningRef.current || processingRef.current) return;
        if (tries++ > 10) return;
        openMicRef.current();
        if (!listeningRef.current) setTimeout(tryOpen, 400);
      };
      setTimeout(tryOpen, 700);
    } else {
      setStatus("idle");
    }
  },[addLog, addChat, speak, stopSR]);

  useEffect(() => { processInputRef.current = processInputFn; }, [processInputFn]);

  // ── Heartbeat watchdog — revives SR if it dies silently ──────────────────
  useEffect(() => {
    watchdogRef.current = setInterval(() => {
      if (!activeRef.current || processingRef.current) return;
      const now = Date.now();
      const timeSinceEvent = now - lastSrEventRef.current;
      // If SR should be listening but hasn't fired any event in 15s, revive it
      if (listeningRef.current && timeSinceEvent > 15_000) {
        addLog("system","[WATCHDOG] SR appears dead — reviving...");
        stopSR();
        setTimeout(() => openMicRef.current(), 300);
      }
    }, 5000); // check every 5s
    return () => {
      if (watchdogRef.current) clearInterval(watchdogRef.current);
    };
  },[addLog, stopSR]);

  // ── sendTextQuery ────────────────────────────────────────────────────────
  const sendTextQuery = useCallback((text: string) => {
    if (!text.trim()) return;
    stopSR();
    processInputRef.current(text.trim());
  },[stopSR]);

  // ── startSession ─────────────────────────────────────────────────────────
  const startSession = useCallback(async (lang: Language = "en") => {
    if (activeRef.current) return;

    try {
      // Request mic permission then IMMEDIATELY release the stream
      // Holding getUserMedia open blocks SR from accessing the mic on some devices
      const stream = await navigator.mediaDevices.getUserMedia({audio:true});
      stream.getTracks().forEach(t => t.stop()); // release mic hardware
      addLog("system","[MIC] Microphone permission granted.");
    } catch {
      addLog("error","[MIC] Permission denied. Please allow microphone access.");
      setStatus("error");
      return;
    }

    langRef.current       = lang;
    activeRef.current     = true;
    processingRef.current = false;
    listeningRef.current  = false;
    speakingRef.current   = false;
    noSpeechRef.current   = 0;
    backoffRef.current    = 300;
    historyRef.current    = [];
    lastSrEventRef.current = Date.now();
    setChatHistory([]);
    const langLabel: Record<string,string> = { en:"EN", zh:"中文", ms:"BM", ta:"தமிழ்" };
    addLog("system",`━━━━━━ VOICE SESSION STARTED [${langLabel[lang]??"EN"}] ━━━━━━`);

    const greeting =
      lang === "zh" ? "你好，我是ARIA，新加坡电子烟资讯助理。请问有什么可以帮助您？" :
      lang === "ms" ? "Helo, saya ARIA, pembantu maklumat vaping Singapura. Boleh saya bantu anda?" :
      lang === "ta" ? "வணக்கம், நான் ARIA, சிங்கப்பூர் வேப்பிங் தகவல் உதவியாளர். நான் உங்களுக்கு எப்படி உதவலாம்?" :
      "Hello! I'm ARIA. How can I help you with vaping information today?";

    addChat("aria", greeting);
    addLog("speak", `[ARIA] ${greeting}`);
    setStatus("speaking");

    // Open mic after greeting finishes
    // Both desktop and mobile: speak first, then open mic cleanly
    // No pre-warm needed — getUserMedia() above already establishes permission
    speak(greeting).then(() => {
      setTimeout(() => {
        if (activeRef.current && !processingRef.current && !listeningRef.current) {
          speakingRef.current = false;
          openMicRef.current();
        }
      }, 300);
    });

    // Safety net: open mic after 7s regardless (covers very slow TTS)
    setTimeout(() => {
      if (activeRef.current && !processingRef.current && !listeningRef.current) {
        speakingRef.current = false;
        openMicRef.current();
      }
    }, 7000);

  },[addLog, addChat, speak]);

  // ── stopSession ──────────────────────────────────────────────────────────
  const stopSession = useCallback(() => {
    activeRef.current     = false;
    processingRef.current = false;
    speakingRef.current   = false;
    noSpeechRef.current   = 0;
    queueRef.current      = [];
    stopSR();
    window.speechSynthesis?.cancel();
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    setStatus("idle");
    addLog("system","━━━━━━ VOICE SESSION ENDED ━━━━━━");
  },[addLog, stopSR]);

  const clearLogs = useCallback(() => {
    setConsoleLog([{id:uid(),timestamp:ts(),type:"system",message:"Console cleared."}]);
  },[]);

  const resetConversation = useCallback(() => {
    historyRef.current = [];
    setChatHistory([]);
    queueRef.current      = [];
    processingRef.current = false;
    noSpeechRef.current   = 0;
    addLog("system","[RESET] Conversation cleared.");
  },[addLog]);

  return {
    status, consoleLog, callbackCases, lookedUpCases, chatHistory,
    startSession, stopSession, clearLogs, resetConversation, sendTextQuery,
    isActive: activeRef, currentLang: langRef,
  };
}
