"use client";
// hooks/useVoiceAgent.ts — ARIA v4.5
// Root fix: store openMic in a ref so SR callbacks always call the latest version
// No more stale closures — mic ALWAYS reopens after each turn

import { useState, useRef, useCallback, useEffect } from "react";

export type AgentStatus = "idle" | "listening" | "thinking" | "speaking" | "error";

export interface ConsoleEntry {
  id: string;
  timestamp: string;
  type: "think" | "action" | "result" | "speak" | "listen" | "error" | "system";
  message: string;
}

export interface VapingCase {
  id: string;
  name: string;
  contact: string;
  email?: string;
  query: string;
  callbackTime?: string;
  status: "open" | "in_progress" | "resolved";
  createdAt: string;
  resolvedAt?: string;
  notes?: string;
}

export interface OffenderCase {
  caseRef: string;
  nric: string;
  name: string;
  age: number;
  offenceType: string;
  offenceDate: string;
  location: string;
  description: string;
  penaltyTier: 1 | 2 | 3;
  penalties: {
    fine?: { amount: number; currency: string; dueDate: string; paid: boolean };
    rehabilitation?: { programme: string; sessions: number; startDate: string; completedSessions: number; status: string };
    jailTerm?: { duration: string; facility: string; startDate: string; releaseDate: string; status: string };
  };
  status: string;
  caseOfficer: string;
  courtDate?: string;
  nextAction: string;
  timeline: Array<{ date: string; event: string; completed: boolean }>;
}

export interface ActionLogEntry {
  tool: string;
  input: object;
  output: object;
}

const TOOL_LABELS: Record<string, string> = {
  search_vaping_info:   "Searching Singapore vaping regulations",
  lookup_offender_case: "Looking up enforcement case",
  log_callback_case:    "Logging callback case",
  get_case_status:      "Retrieving callback case status",
};

function stripMd(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1").replace(/\*(.+?)\*/g, "$1")
    .replace(/`(.+?)`/g, "$1").replace(/#{1,6}\s+/g, "")
    .replace(/\[(.+?)\]\(.+?\)/g, "$1").replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+\.\s+/gm, "").replace(/_{1,2}(.+?)_{1,2}/g, "$1")
    .replace(/>\s+/g, "").trim();
}

function ts() { return new Date().toLocaleTimeString("en-US", { hour12: false }); }
function uid() { return Math.random().toString(36).slice(2, 9); }

const NOISE_PHRASES = new Set([
  "", "okay", "ok", "yes", "no", "hmm", "um", "uh", "ah", "oh",
  "hey", "hi", "bye", "goodbye", "thanks", "thank you", "sure",
  "right", "alright", "i see",
]);

function isNoise(text: string, confidence: number): boolean {
  const t = text.trim().toLowerCase();
  if (t.length < 3) return true;
  if (confidence < 0.45) return true;
  if (NOISE_PHRASES.has(t)) return true;
  return false;
}

export function useVoiceAgent() {
  const [status, setStatus]               = useState<AgentStatus>("idle");
  const [consoleLog, setConsoleLog]       = useState<ConsoleEntry[]>([
    { id: uid(), timestamp: ts(), type: "system", message: "ARIA v4.5.0 — Singapore Vaping Public Health Assistant ready." },
    { id: uid(), timestamp: ts(), type: "system", message: "Capabilities: Vaping info, offender case lookup, callback case logging, FAQ generation." },
    { id: uid(), timestamp: ts(), type: "system", message: "Use voice or type your question at any time." },
  ]);
  const [callbackCases, setCallbackCases] = useState<VapingCase[]>([]);
  const [lookedUpCases, setLookedUpCases] = useState<OffenderCase[]>([]);
  const [chatHistory, setChatHistory]     = useState<Array<{ role: "user" | "aria"; text: string }>>([]);

  // All mutable state in refs — prevents stale closure issues entirely
  const historyRef    = useRef<object[]>([]);
  const processingRef = useRef(false);
  const listeningRef  = useRef(false);
  const activeRef     = useRef(false);
  const noSpeechRef   = useRef(0);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const srRef         = useRef<any>(null);
  const audioRef      = useRef<HTMLAudioElement | null>(null);
  const queueRef      = useRef<string[]>([]);

  // KEY FIX: store the latest openMic function in a ref
  // SR event callbacks (onresult, onerror, onend) read from this ref
  // so they ALWAYS call the most current version — no stale closures possible
  const openMicRef    = useRef<() => void>(() => {});

  // Stable log/chat helpers
  const addLog = useCallback((type: ConsoleEntry["type"], msg: string) => {
    setConsoleLog(p => [...p, { id: uid(), timestamp: ts(), type, message: msg }]);
  }, []);
  const addChat = useCallback((role: "user" | "aria", text: string) => {
    setChatHistory(p => [...p, { role, text: stripMd(text) }]);
  }, []);

  // ── TTS: browser fallback ─────────────────────────────────────────────────
  const speakBrowser = useCallback((text: string): Promise<void> => new Promise(resolve => {
    if (!("speechSynthesis" in window)) { resolve(); return; }
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(stripMd(text));
    u.rate = 1.0; u.pitch = 1.0;
    const v = window.speechSynthesis.getVoices().find(v => v.name.includes("Samantha") || v.lang === "en-US");
    if (v) u.voice = v;
    u.onend = () => resolve();
    u.onerror = () => resolve();
    window.speechSynthesis.speak(u);
  }), []);

  // ── TTS: ElevenLabs with 8s timeout ──────────────────────────────────────
  const speak = useCallback(async (text: string): Promise<void> => {
    const clean = stripMd(text);
    const key = process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY;
    if (!key) return speakBrowser(clean);
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      const res = await fetch("https://api.elevenlabs.io/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM/stream", {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json", "xi-api-key": key },
        body: JSON.stringify({
          text: clean, model_id: "eleven_turbo_v2",
          voice_settings: { stability: 0.5, similarity_boost: 0.85, style: 0.2, use_speaker_boost: true },
        }),
      });
      clearTimeout(timer);
      if (!res.ok) return speakBrowser(clean);
      const url = URL.createObjectURL(await res.blob());
      return new Promise(resolve => {
        if (audioRef.current) { audioRef.current.pause(); URL.revokeObjectURL(audioRef.current.src); }
        const a = new Audio(url);
        audioRef.current = a;
        const done = () => { URL.revokeObjectURL(url); resolve(); };
        a.onended = done; a.onerror = done;
        a.play().catch(() => { done(); speakBrowser(clean); });
      });
    } catch { return speakBrowser(clean); }
  }, [speakBrowser]);

  // ── openMic: defined as regular function, stored in ref via useEffect ─────
  // Using useEffect to update the ref whenever dependencies change
  // SR callbacks read openMicRef.current — always the latest version
  const openMicFn = useCallback(() => {
    if (!activeRef.current || listeningRef.current || processingRef.current) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SR) {
      addLog("error", "[MIC] Speech recognition not available. Use Chrome or Edge.");
      return;
    }

    const r = new SR();
    r.lang = "en-US";
    r.interimResults = false;
    r.maxAlternatives = 1;
    r.continuous = false;

    r.onstart = () => {
      listeningRef.current = true;
      noSpeechRef.current = 0;
      setStatus("listening");
      addLog("listen", "[MIC] Listening...");
    };

    r.onresult = (e: Event) => {
      listeningRef.current = false;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = (e as any).results[0][0];
      const text: string = result.transcript ?? "";
      const conf: number = result.confidence ?? 1;
      r.stop();

      if (isNoise(text, conf)) {
        addLog("system", `[MIC] Ignored: "${text}" (conf:${conf.toFixed(2)})`);
        // Read from ref — always current
        setTimeout(() => openMicRef.current(), 500);
        return;
      }
      // processInput via ref too
      processInputRef.current(text);
    };

    r.onerror = (e: Event) => {
      listeningRef.current = false;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const err = (e as any).error;
      if (err === "no-speech") {
        noSpeechRef.current += 1;
        if (noSpeechRef.current <= 6 && activeRef.current && !processingRef.current) {
          setTimeout(() => openMicRef.current(), 700);
        } else {
          noSpeechRef.current = 0;
          activeRef.current = false;
          setStatus("idle");
          addLog("system", "[MIC] No speech detected — session paused. Tap Start to resume.");
        }
      } else if (err === "not-allowed" || err === "permission-denied") {
        addLog("error", "[MIC] Permission denied. Please allow microphone in browser settings.");
        setStatus("error");
        activeRef.current = false;
      } else {
        addLog("error", `[MIC] ${err}`);
        if (activeRef.current && !processingRef.current) {
          setTimeout(() => openMicRef.current(), 800);
        }
      }
    };

    r.onend = () => {
      listeningRef.current = false;
      srRef.current = null;
    };

    srRef.current = r;
    try { r.start(); } catch { listeningRef.current = false; setTimeout(() => openMicRef.current(), 500); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addLog]);

  // Keep openMicRef always pointing to latest openMicFn
  useEffect(() => { openMicRef.current = openMicFn; }, [openMicFn]);

  // ── processInput: also stored in ref ──────────────────────────────────────
  // This allows openMic's onresult to call processInput without stale closure
  const processInputRef = useRef<(input: string) => void>(() => {});

  const processInputFn = useCallback(async (input: string) => {
    if (processingRef.current) {
      queueRef.current.push(input);
      addLog("system", `[QUEUE] "${input}"`);
      return;
    }

    srRef.current?.stop();
    listeningRef.current = false;
    processingRef.current = true;
    setStatus("thinking");
    addChat("user", input);
    addLog("listen", `[USER] "${input}"`);

    let reply = "I encountered an error. Please try again.";
    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: input, conversationHistory: historyRef.current }),
      });
      const data = await res.json();

      if (data.actionLog?.length) {
        for (const e of data.actionLog as ActionLogEntry[]) {
          addLog("action", `[TOOL] ${e.tool} → ${TOOL_LABELS[e.tool] ?? e.tool}`);
          const out = e.output as Record<string, unknown>;
          if (out.success === false) addLog("error", `[FAIL] ${out.error ?? "error"}`);
          else addLog("result", `[OK] ${out.message ?? out.summary ?? "[Done]"}`);
        }
      }
      if (data.newCases?.length) {
        setCallbackCases(p => [...p, ...data.newCases]);
        for (const c of data.newCases as VapingCase[]) addLog("result", `[CASE] ${c.id} — ${c.name}`);
      }
      if (data.offenderResults?.length) {
        setLookedUpCases(p => {
          const seen = new Set(p.map(c => c.caseRef));
          return [...p, ...(data.offenderResults as OffenderCase[]).filter(c => !seen.has(c.caseRef))];
        });
        for (const c of data.offenderResults as OffenderCase[]) addLog("result", `[LOOKUP] ${c.caseRef} — ${c.name}`);
      }
      if (Array.isArray(data.updatedHistory)) historyRef.current = data.updatedHistory;
      reply = stripMd(data.response ?? reply);
    } catch (err) {
      addLog("error", `[ERROR] ${err instanceof Error ? err.message : String(err)}`);
    }

    addChat("aria", reply);
    addLog("speak", `[ARIA] ${reply}`);
    setStatus("speaking");
    await speak(reply);

    processingRef.current = false;

    if (queueRef.current.length > 0) {
      const next = queueRef.current.shift()!;
      setTimeout(() => processInputRef.current(next), 200);
    } else if (activeRef.current) {
      // Poll every 300ms up to 3 seconds to open mic after TTS ends
      // This is belt-and-suspenders: ensures mic opens even if first attempt is blocked
      let attempts = 0;
      const tryOpen = () => {
        attempts++;
        if (!activeRef.current) return; // session ended
        if (listeningRef.current) return; // already listening
        if (processingRef.current) return; // new request came in
        if (attempts > 10) return; // give up after 3s
        openMicRef.current();
        // If openMic succeeded, listeningRef will be true shortly
        // If not (e.g. SR busy), try again
        setTimeout(() => {
          if (activeRef.current && !listeningRef.current && !processingRef.current) {
            tryOpen();
          }
        }, 300);
      };
      setTimeout(tryOpen, 500);
    } else {
      setStatus("idle");
    }
  }, [addLog, addChat, speak]);

  // Keep processInputRef always pointing to latest processInputFn
  useEffect(() => { processInputRef.current = processInputFn; }, [processInputFn]);

  // ── Public sendTextQuery ──────────────────────────────────────────────────
  const sendTextQuery = useCallback((text: string) => {
    if (!text.trim()) return;
    srRef.current?.stop();
    listeningRef.current = false;
    processInputRef.current(text.trim());
  }, []);

  // ── Start session ─────────────────────────────────────────────────────────
  const startSession = useCallback(async () => {
    if (activeRef.current) return;

    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      addLog("system", "[MIC] Microphone permission granted.");
    } catch {
      addLog("error", "[MIC] Microphone permission denied. Please allow access and try again.");
      setStatus("error");
      return;
    }

    activeRef.current = true;
    noSpeechRef.current = 0;
    processingRef.current = false;
    listeningRef.current = false;
    historyRef.current = [];
    setChatHistory([]);
    addLog("system", "━━━━━━ VOICE SESSION STARTED ━━━━━━");

    const greeting = "Hello, I am ARIA. How can I help you with vaping information today?";
    addChat("aria", greeting);
    setStatus("speaking");

    // Open mic after 5s regardless (safety net for slow TTS)
    setTimeout(() => {
      if (activeRef.current && !processingRef.current && !listeningRef.current) {
        openMicRef.current();
      }
    }, 5000);

    // Open mic as soon as greeting finishes
    speak(greeting).then(() => {
      if (activeRef.current && !processingRef.current && !listeningRef.current) {
        setTimeout(() => openMicRef.current(), 400);
      }
    });
  }, [addLog, addChat, speak]);

  // ── Stop session ──────────────────────────────────────────────────────────
  const stopSession = useCallback(() => {
    activeRef.current = false;
    listeningRef.current = false;
    processingRef.current = false;
    noSpeechRef.current = 0;
    queueRef.current = [];
    srRef.current?.stop();
    window.speechSynthesis?.cancel();
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    setStatus("idle");
    addLog("system", "━━━━━━ VOICE SESSION ENDED ━━━━━━");
  }, [addLog]);

  const clearLogs = useCallback(() => {
    setConsoleLog([{ id: uid(), timestamp: ts(), type: "system", message: "Console cleared." }]);
  }, []);

  const resetConversation = useCallback(() => {
    historyRef.current = [];
    setChatHistory([]);
    queueRef.current = [];
    processingRef.current = false;
    noSpeechRef.current = 0;
    addLog("system", "[RESET] Conversation cleared.");
  }, [addLog]);

  return {
    status, consoleLog, callbackCases, lookedUpCases, chatHistory,
    startSession, stopSession, clearLogs, resetConversation, sendTextQuery,
    isActive: activeRef,
  };
}
