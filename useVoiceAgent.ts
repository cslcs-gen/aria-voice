"use client";
// hooks/useVoiceAgent.ts — ARIA v4.0

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
  search_vaping_info:    "Searching Singapore vaping regulations",
  lookup_offender_case:  "Looking up enforcement case",
  log_callback_case:     "Logging callback case",
  get_case_status:       "Retrieving callback case status",
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

export function useVoiceAgent() {
  const [status, setStatus] = useState<AgentStatus>("idle");
  const [consoleLog, setConsoleLog] = useState<ConsoleEntry[]>([
    { id: uid(), timestamp: ts(), type: "system", message: "ARIA v4.0.0 — Singapore Vaping Public Health Assistant ready." },
    { id: uid(), timestamp: ts(), type: "system", message: "Capabilities: Vaping info, offender case lookup, callback case logging, FAQ generation." },
    { id: uid(), timestamp: ts(), type: "system", message: "Use voice or type your question at any time." },
  ]);
  const [callbackCases, setCallbackCases] = useState<VapingCase[]>([]);
  const [lookedUpCases, setLookedUpCases] = useState<OffenderCase[]>([]);
  const [chatHistory, setChatHistory] = useState<Array<{ role: "user" | "aria"; text: string }>>([]);

  const historyRef = useRef<object[]>([]);
  const processingRef = useRef(false);
  const queueRef = useRef<string[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const activeVoiceRef = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const addLog = useCallback((type: ConsoleEntry["type"], message: string) => {
    setConsoleLog(prev => [...prev, { id: uid(), timestamp: ts(), type, message }]);
  }, []);

  const addChat = useCallback((role: "user" | "aria", text: string) => {
    setChatHistory(prev => [...prev, { role, text: stripMd(text) }]);
  }, []);

  const speakBrowser = useCallback((text: string): Promise<void> => {
    return new Promise(resolve => {
      if (!("speechSynthesis" in window)) { resolve(); return; }
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(stripMd(text));
      u.rate = 1.0; u.pitch = 1.0;
      const voices = window.speechSynthesis.getVoices();
      const preferred = voices.find(v => v.name.includes("Samantha") || v.lang === "en-US");
      if (preferred) u.voice = preferred;
      u.onend = () => resolve(); u.onerror = () => resolve();
      window.speechSynthesis.speak(u);
    });
  }, []);

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
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      return new Promise(resolve => {
        if (audioRef.current) { audioRef.current.pause(); URL.revokeObjectURL(audioRef.current.src); }
        const audio = new Audio(url);
        audioRef.current = audio;
        audio.onended = () => { URL.revokeObjectURL(url); resolve(); };
        audio.onerror = () => { URL.revokeObjectURL(url); resolve(); };
        audio.play().catch(() => resolve());
      });
    } catch { return speakBrowser(clean); }
  }, [speakBrowser]);

  const startListeningInternal = useCallback(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SR) return;
    const r = new SR();
    r.lang = "en-US"; r.interimResults = false; r.maxAlternatives = 1; r.continuous = false;
    r.onstart = () => setStatus("listening");
    r.onresult = (e: Event) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const text = (e as any).results[0][0].transcript;
      r.stop();
      processInput(text);
    };
    r.onerror = (e: Event) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const err = (e as any).error;
      if (err === "no-speech" && activeVoiceRef.current && !processingRef.current) {
        setTimeout(() => startListeningInternal(), 500);
      } else if (err !== "no-speech") {
        addLog("error", `[MIC] ${err}`);
        setStatus("idle");
      }
    };
    r.onend = () => { recognitionRef.current = null; };
    recognitionRef.current = r;
    try { r.start(); } catch { /* already started */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addLog]);

  const processInput = useCallback(async (input: string) => {
    if (processingRef.current) {
      queueRef.current.push(input);
      addLog("system", `[QUEUE] Queued: "${input}"`);
      return;
    }
    processingRef.current = true;
    setStatus("thinking");
    addChat("user", input);
    addLog("listen", `[USER] "${input}"`);
    addLog("think", "Processing...");

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
          if (out.success === false) addLog("error", `[FAIL] ${out.error ?? "Unknown error"}`);
          else addLog("result", `[OK] ${out.message ?? out.summary ?? "[Done]"}`);
        }
      }
      if (data.newCases?.length) {
        setCallbackCases(prev => [...prev, ...data.newCases]);
        for (const c of data.newCases as VapingCase[]) addLog("result", `[CASE] ${c.id} logged for ${c.name}`);
      }
      if (data.offenderResults?.length) {
        setLookedUpCases(prev => {
          const existing = new Set(prev.map(c => c.caseRef));
          const newOnes = (data.offenderResults as OffenderCase[]).filter(c => !existing.has(c.caseRef));
          return [...prev, ...newOnes];
        });
        for (const c of data.offenderResults as OffenderCase[]) addLog("result", `[LOOKUP] Case ${c.caseRef} retrieved for ${c.name}`);
      }
      if (data.updatedHistory && Array.isArray(data.updatedHistory)) historyRef.current = data.updatedHistory;

      const reply = stripMd(data.response ?? "Action completed.");
      addChat("aria", reply);
      addLog("speak", `[ARIA] ${reply}`);
      setStatus("speaking");
      await speak(reply);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown";
      addLog("error", `[ERROR] ${msg}`);
      const fallback = "I encountered an error. Please try again.";
      addChat("aria", fallback);
      await speak(fallback);
    } finally {
      processingRef.current = false;
      if (queueRef.current.length > 0) {
        const next = queueRef.current.shift()!;
        setTimeout(() => processInput(next), 300);
      } else if (activeVoiceRef.current) {
        setStatus("listening");
        startListeningInternal();
      } else {
        setStatus("idle");
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addLog, addChat, speak, startListeningInternal]);

  const sendTextQuery = useCallback((text: string) => {
    if (!text.trim()) return;
    processInput(text.trim());
  }, [processInput]);

  const startSession = useCallback(() => {
    if (activeVoiceRef.current) return;
    activeVoiceRef.current = true;
    historyRef.current = [];
    setChatHistory([]);
    addLog("system", "━━━━━━ VOICE SESSION STARTED ━━━━━━");
    const greeting = "Hello, I am ARIA, the Singapore vaping information assistant. I can answer vaping questions, look up your enforcement case by NRIC or case reference, or arrange an officer callback. How can I help you today?";
    speak(greeting).then(() => {
      addChat("aria", greeting);
      if (activeVoiceRef.current && !processingRef.current) startListeningInternal();
    });
  }, [addLog, addChat, speak, startListeningInternal]);

  const stopSession = useCallback(() => {
    activeVoiceRef.current = false;
    recognitionRef.current?.stop();
    window.speechSynthesis?.cancel();
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    queueRef.current = [];
    processingRef.current = false;
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
    addLog("system", "[RESET] Conversation cleared.");
  }, [addLog]);

  return {
    status, consoleLog, callbackCases, lookedUpCases, chatHistory,
    startSession, stopSession, clearLogs, resetConversation, sendTextQuery,
    isActive: activeVoiceRef,
  };
}
