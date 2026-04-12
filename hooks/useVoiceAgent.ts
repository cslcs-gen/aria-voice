"use client";
// hooks/useVoiceAgent.ts — ARIA Vaping Assistant v3.1
// Fixes: persistent conversation history, markdown stripping, text input support

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

export interface ActionLogEntry {
  tool: string;
  input: object;
  output: object;
}

const TOOL_LABELS: Record<string, string> = {
  search_vaping_info: "Searching Singapore vaping regulations",
  log_callback_case:  "Logging callback case for officer follow-up",
  get_case_status:    "Retrieving case status",
  list_all_cases:     "Fetching all cases",
};

// Strip markdown from text before speaking
function stripMarkdownClient(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/`(.+?)`/g, "$1")
    .replace(/#{1,6}\s+/g, "")
    .replace(/\[(.+?)\]\(.+?\)/g, "$1")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+\.\s+/gm, "")
    .replace(/_{1,2}(.+?)_{1,2}/g, "$1")
    .replace(/>\s+/g, "")
    .trim();
}

function ts() { return new Date().toLocaleTimeString("en-US", { hour12: false }); }
function uid() { return Math.random().toString(36).slice(2, 9); }

export function useVoiceAgent() {
  const [status, setStatus] = useState<AgentStatus>("idle");
  const [consoleLog, setConsoleLog] = useState<ConsoleEntry[]>([
    { id: uid(), timestamp: ts(), type: "system", message: "ARIA v3.1.0 — Singapore Vaping Public Health Assistant initialized." },
    { id: uid(), timestamp: ts(), type: "system", message: "Knowledge base: Singapore HSA & NEA vaping regulations 2024." },
    { id: uid(), timestamp: ts(), type: "system", message: "Tools: search_vaping_info, log_callback_case, get_case_status, list_all_cases" },
    { id: uid(), timestamp: ts(), type: "system", message: "Ready. Use voice or type your query below." },
  ]);
  const [cases, setCases] = useState<VapingCase[]>([]);
  const [transcript, setTranscript] = useState("");
  const [lastResponse, setLastResponse] = useState("");

  // Conversation history stored in a ref so it NEVER resets between turns
  const conversationHistoryRef = useRef<object[]>([]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const activeRef = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const sessionStartedRef = useRef(false);

  const addLog = useCallback((type: ConsoleEntry["type"], message: string) => {
    setConsoleLog((prev) => [...prev, { id: uid(), timestamp: ts(), type, message }]);
  }, []);

  // ── Browser TTS ──────────────────────────────────────────────────────────────
  const speakWithBrowser = useCallback((text: string): Promise<void> => {
    return new Promise((resolve) => {
      if (!("speechSynthesis" in window)) { resolve(); return; }
      window.speechSynthesis.cancel();
      const clean = stripMarkdownClient(text);
      const u = new SpeechSynthesisUtterance(clean);
      u.rate = 1.0; u.pitch = 1.0;
      const voices = window.speechSynthesis.getVoices();
      const preferred = voices.find((v) =>
        v.name.includes("Samantha") || v.name.includes("Google US English") || v.lang === "en-US"
      );
      if (preferred) u.voice = preferred;
      u.onend = () => resolve();
      u.onerror = () => resolve();
      window.speechSynthesis.speak(u);
    });
  }, []);

  // ── ElevenLabs TTS ───────────────────────────────────────────────────────────
  const speak = useCallback(async (text: string): Promise<void> => {
    const clean = stripMarkdownClient(text);
    const apiKey = process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY;
    if (!apiKey) return speakWithBrowser(clean);
    try {
      const res = await fetch(
        "https://api.elevenlabs.io/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM/stream",
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "xi-api-key": apiKey },
          body: JSON.stringify({
            text: clean,
            model_id: "eleven_turbo_v2",
            voice_settings: { stability: 0.5, similarity_boost: 0.85, style: 0.2, use_speaker_boost: true },
          }),
        }
      );
      if (!res.ok) return speakWithBrowser(clean);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      return new Promise((resolve) => {
        if (audioRef.current) { audioRef.current.pause(); URL.revokeObjectURL(audioRef.current.src); }
        const audio = new Audio(url);
        audioRef.current = audio;
        audio.onended = () => { URL.revokeObjectURL(url); resolve(); };
        audio.onerror = () => { URL.revokeObjectURL(url); resolve(); };
        audio.play().catch(() => resolve());
      });
    } catch {
      return speakWithBrowser(clean);
    }
  }, [speakWithBrowser]);

  // ── Core: send any input (voice or text) to agent ────────────────────────────
  const sendToAgent = useCallback(async (userInput: string) => {
    setStatus("thinking");
    setTranscript(userInput);
    addLog("listen", `[USER] "${userInput}"`);
    addLog("think", "Processing query...");

    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript: userInput,
          // Always send the FULL history from the ref — never from state
          conversationHistory: conversationHistoryRef.current,
        }),
      });

      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const data = await res.json();

      // Process action log entries
      if (data.actionLog?.length) {
        for (const entry of data.actionLog as ActionLogEntry[]) {
          const label = TOOL_LABELS[entry.tool] ?? entry.tool;
          addLog("action", `[TOOL] ${entry.tool} → ${label}`);
          const out = entry.output as Record<string, unknown>;
          if (out.success === false) {
            addLog("error", `[FAIL] ${out.error ?? "Unknown error"}`);
          } else {
            addLog("result", `[OK] ${out.message ?? "[Done]"}`);
          }
        }
      }

      // Update cases
      if (data.newCases?.length) {
        setCases((prev) => [...prev, ...data.newCases]);
        for (const c of data.newCases as VapingCase[]) {
          addLog("result", `[CASE] ${c.id} logged for ${c.name}`);
        }
      }

      // CRITICAL: Update history ref immediately — not state — to prevent stale closures
      if (data.updatedHistory && Array.isArray(data.updatedHistory)) {
        conversationHistoryRef.current = data.updatedHistory;
        addLog("system", `[HISTORY] ${data.updatedHistory.length} messages in context`);
      }

      const reply: string = stripMarkdownClient(data.response ?? "I have completed that action.");
      setLastResponse(reply);
      addLog("speak", `[ARIA] ${reply}`);

      setStatus("speaking");
      await speak(reply);

      // Resume listening only if voice session is active
      if (activeRef.current) {
        startListening();
      } else {
        setStatus("idle");
      }
    } catch (err) {
      addLog("error", `[ERROR] ${err instanceof Error ? err.message : "Unknown"}`);
      setStatus("error");
      await speak("I encountered an error. Please try again.");
      if (activeRef.current) startListening();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addLog, speak]);

  // ── Speech recognition ────────────────────────────────────────────────────────
  const startListening = useCallback(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SR) {
      addLog("error", "[ERROR] Use Chrome or Edge for voice support.");
      setStatus("error");
      return;
    }
    const r = new SR();
    r.lang = "en-US"; r.interimResults = false; r.maxAlternatives = 1; r.continuous = false;
    r.onstart = () => { setStatus("listening"); addLog("listen", "[MIC] Listening..."); };
    r.onresult = (e: Event) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const text = (e as any).results[0][0].transcript;
      r.stop();
      sendToAgent(text);
    };
    r.onerror = (e: Event) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const err = (e as any).error;
      if (err === "no-speech") {
        addLog("system", "[MIC] No speech detected, retrying...");
        if (activeRef.current) startListening();
      } else {
        addLog("error", `[MIC] ${err}`);
        setStatus("error");
      }
    };
    r.onend = () => { recognitionRef.current = null; };
    recognitionRef.current = r;
    r.start();
  }, [addLog, sendToAgent]);

  // ── Text input handler (for typed queries) ────────────────────────────────────
  const sendTextQuery = useCallback((text: string) => {
    if (!text.trim()) return;
    // If session not started yet, initialise it silently (no greeting needed for text)
    if (!sessionStartedRef.current) {
      sessionStartedRef.current = true;
      conversationHistoryRef.current = [];
      addLog("system", "━━━━━━ TEXT SESSION STARTED ━━━━━━");
    }
    sendToAgent(text);
  }, [addLog, sendToAgent]);

  // ── Voice session controls ────────────────────────────────────────────────────
  const startSession = useCallback(() => {
    if (activeRef.current) return;
    activeRef.current = true;
    sessionStartedRef.current = true;
    // Clear history ONLY when starting a brand new session
    conversationHistoryRef.current = [];
    addLog("system", "━━━━━━ VOICE SESSION STARTED ━━━━━━");
    speak(
      "Hello, I am ARIA, the Singapore vaping information assistant. I can help you with vaping laws, health effects, how to report violations, or arrange an officer to call you back. How can I help you today?"
    ).then(() => { if (activeRef.current) startListening(); });
  }, [addLog, speak, startListening]);

  const stopSession = useCallback(() => {
    activeRef.current = false;
    recognitionRef.current?.stop();
    window.speechSynthesis?.cancel();
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    setStatus("idle");
    addLog("system", "━━━━━━ SESSION ENDED ━━━━━━");
  }, [addLog]);

  const clearLogs = useCallback(() => {
    setConsoleLog([{ id: uid(), timestamp: ts(), type: "system", message: "Console cleared. ARIA ready." }]);
  }, []);

  const resetConversation = useCallback(() => {
    conversationHistoryRef.current = [];
    sessionStartedRef.current = false;
    setTranscript("");
    setLastResponse("");
    addLog("system", "[RESET] Conversation history cleared. New session ready.");
  }, [addLog]);

  return {
    status, consoleLog, cases, transcript, lastResponse,
    startSession, stopSession, clearLogs, resetConversation,
    sendTextQuery, isActive: activeRef,
  };
}
