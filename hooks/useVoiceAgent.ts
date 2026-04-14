"use client";
// hooks/useVoiceAgent.ts — ARIA v4.2
// Fix A: request mic permission on session start before recognition
// Fix B: reliable speak→listen cycle with guaranteed mic re-open after each response

import { useState, useRef, useCallback } from "react";

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

// ── Helpers ───────────────────────────────────────────────────────────────────
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

// Short noise phrases to ignore — only exact or near-exact short matches
const NOISE_PHRASES = new Set([
  "","okay","ok","yes","no","hmm","um","uh","ah","oh","hey","hi","bye","goodbye","thanks","thank you","sure","right","alright","i see",
]);

function isNoise(text: string, confidence: number): boolean {
  const t = text.trim().toLowerCase();
  if (t.length < 3) return true;
  if (confidence < 0.5) return true;
  if (NOISE_PHRASES.has(t)) return true;
  return false;
}

// ── Hook ──────────────────────────────────────────────────────────────────────
export function useVoiceAgent() {
  const [status, setStatus] = useState<AgentStatus>("idle");
  const [consoleLog, setConsoleLog] = useState<ConsoleEntry[]>([
    { id: uid(), timestamp: ts(), type: "system", message: "ARIA v4.2.0 — Singapore Vaping Public Health Assistant ready." },
    { id: uid(), timestamp: ts(), type: "system", message: "Capabilities: Vaping info, offender case lookup, callback case logging, FAQ generation." },
    { id: uid(), timestamp: ts(), type: "system", message: "Use voice or type your question at any time." },
  ]);
  const [callbackCases, setCallbackCases] = useState<VapingCase[]>([]);
  const [lookedUpCases, setLookedUpCases]  = useState<OffenderCase[]>([]);
  const [chatHistory, setChatHistory]      = useState<Array<{ role: "user" | "aria"; text: string }>>([]);

  // Refs — these never trigger re-renders and are always current
  const historyRef     = useRef<object[]>([]);
  const processingRef  = useRef(false);  // true while fetch is in flight
  const listeningRef   = useRef(false);  // true while SR is open
  const queueRef       = useRef<string[]>([]);
  const activeRef      = useRef(false);  // true while voice session is on
  const noSpeechCount  = useRef(0);
  const streamRef      = useRef<MediaStream | null>(null); // mic stream
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const srRef          = useRef<any>(null);
  const audioRef       = useRef<HTMLAudioElement | null>(null);

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
    u.onend = () => resolve(); u.onerror = () => resolve();
    window.speechSynthesis.speak(u);
  }), []);

  // ── TTS: ElevenLabs with browser fallback ────────────────────────────────
  const speak = useCallback(async (text: string): Promise<void> => {
    const clean = stripMd(text);
    const key = process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY;
    if (!key) return speakBrowser(clean);
    try {
      const res = await fetch("https://api.elevenlabs.io/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json", "xi-api-key": key },
        body: JSON.stringify({ text: clean, model_id: "eleven_turbo_v2", voice_settings: { stability: 0.5, similarity_boost: 0.85, style: 0.2, use_speaker_boost: true } }),
      });
      if (!res.ok) return speakBrowser(clean);
      const url = URL.createObjectURL(await res.blob());
      return new Promise(resolve => {
        if (audioRef.current) { audioRef.current.pause(); URL.revokeObjectURL(audioRef.current.src); }
        const a = new Audio(url);
        audioRef.current = a;
        const done = () => { URL.revokeObjectURL(url); resolve(); };
        a.onended = done; a.onerror = done;
        a.play().catch(done);
      });
    } catch { return speakBrowser(clean); }
  }, [speakBrowser]);

  // ── Open mic (called AFTER speak resolves) ────────────────────────────────
  const openMic = useCallback(() => {
    if (!activeRef.current || listeningRef.current || processingRef.current) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SR) { addLog("error", "[MIC] Speech recognition not available. Use Chrome or Edge."); return; }

    const r = new SR();
    r.lang = "en-US"; r.interimResults = false; r.maxAlternatives = 1; r.continuous = false;

    r.onstart = () => {
      listeningRef.current = true;
      noSpeechCount.current = 0;
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
        addLog("system", `[MIC] Ignored noise: "${text}" (conf: ${conf.toFixed(2)})`);
        // Reopen mic after short pause
        setTimeout(() => openMic(), 600);
        return;
      }
      processInput(text);
    };

    r.onerror = (e: Event) => {
      listeningRef.current = false;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const err = (e as any).error;
      if (err === "no-speech") {
        noSpeechCount.current += 1;
        if (noSpeechCount.current <= 5 && activeRef.current) {
          setTimeout(() => openMic(), 800);
        } else {
          noSpeechCount.current = 0;
          activeRef.current = false;
          addLog("system", "[MIC] No speech detected — session paused. Tap Start to resume.");
          setStatus("idle");
        }
      } else if (err === "not-allowed" || err === "permission-denied") {
        addLog("error", "[MIC] Microphone permission denied. Please allow access in your browser.");
        setStatus("error");
        activeRef.current = false;
      } else {
        addLog("error", `[MIC] Error: ${err}`);
        if (activeRef.current) setTimeout(() => openMic(), 1000);
      }
    };

    r.onend = () => {
      listeningRef.current = false;
      srRef.current = null;
    };

    srRef.current = r;
    try { r.start(); } catch { listeningRef.current = false; }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addLog]);

  // ── Agent call ────────────────────────────────────────────────────────────
  const processInput = useCallback(async (input: string) => {
    if (processingRef.current) {
      queueRef.current.push(input);
      addLog("system", `[QUEUE] "${input}"`);
      return;
    }
    processingRef.current = true;
    listeningRef.current = false;
    srRef.current?.stop();
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

    // Speak — then reliably open mic regardless of what happened
    await speak(reply);

    processingRef.current = false;

    if (queueRef.current.length > 0) {
      const next = queueRef.current.shift()!;
      setTimeout(() => processInput(next), 200);
    } else if (activeRef.current) {
      // Fixed delay after TTS ends before opening mic
      // Gives audio hardware time to switch from output to input mode
      setStatus("listening"); // show indicator immediately
      setTimeout(() => openMic(), 800);
    } else {
      setStatus("idle");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addLog, addChat, speak, openMic]);

  // ── Request mic permission upfront ───────────────────────────────────────
  const requestMicPermission = useCallback(async (): Promise<boolean> => {
    try {
      // This triggers the browser permission dialog immediately
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Keep stream alive so permission stays granted
      streamRef.current = stream;
      addLog("system", "[MIC] Microphone permission granted.");
      return true;
    } catch (err) {
      addLog("error", `[MIC] Microphone permission denied: ${err}`);
      setStatus("error");
      return false;
    }
  }, [addLog]);

  // ── Start voice session ───────────────────────────────────────────────────
  const startSession = useCallback(async () => {
    if (activeRef.current) return;

    // Step 1: Request mic permission FIRST — this shows the browser dialog immediately
    const permitted = await requestMicPermission();
    if (!permitted) return;

    activeRef.current = true;
    noSpeechCount.current = 0;
    historyRef.current = [];
    setChatHistory([]);
    addLog("system", "━━━━━━ VOICE SESSION STARTED ━━━━━━");

    const greeting = "Hello, I am ARIA, the Singapore vaping information assistant. I can answer vaping questions, look up your enforcement case by NRIC or case reference, or arrange an officer callback. How can I help you today?";

    setStatus("speaking");
    await speak(greeting);
    addChat("aria", greeting);

    // Open mic immediately after greeting finishes
    if (activeRef.current) {
      setTimeout(() => openMic(), 600);
    }
  }, [addLog, addChat, speak, openMic, requestMicPermission]);

  // ── Stop session ──────────────────────────────────────────────────────────
  const stopSession = useCallback(() => {
    activeRef.current = false;
    listeningRef.current = false;
    processingRef.current = false;
    noSpeechCount.current = 0;
    queueRef.current = [];

    srRef.current?.stop();
    window.speechSynthesis?.cancel();
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }

    // Release mic stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }

    setStatus("idle");
    addLog("system", "━━━━━━ VOICE SESSION ENDED ━━━━━━");
  }, [addLog]);

  // ── Text query — always available ─────────────────────────────────────────
  const sendTextQuery = useCallback((text: string) => {
    if (!text.trim()) return;
    // Stop listening if active before processing text
    srRef.current?.stop();
    listeningRef.current = false;
    processInput(text.trim());
  }, [processInput]);

  const clearLogs = useCallback(() => {
    setConsoleLog([{ id: uid(), timestamp: ts(), type: "system", message: "Console cleared." }]);
  }, []);

  const resetConversation = useCallback(() => {
    historyRef.current = [];
    setChatHistory([]);
    queueRef.current = [];
    processingRef.current = false;
    noSpeechCount.current = 0;
    addLog("system", "[RESET] Conversation cleared.");
  }, [addLog]);

  return {
    status, consoleLog, callbackCases, lookedUpCases, chatHistory,
    startSession, stopSession, clearLogs, resetConversation, sendTextQuery,
    isActive: activeRef,
  };
}
