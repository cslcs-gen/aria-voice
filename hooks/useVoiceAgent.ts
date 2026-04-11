"use client";
// hooks/useVoiceAgent.ts — unchanged agentic logic

import { useState, useRef, useCallback } from "react";

export type AgentStatus = "idle" | "listening" | "thinking" | "speaking" | "error";

export interface ConsoleEntry {
  id: string;
  timestamp: string;
  type: "think" | "action" | "result" | "speak" | "listen" | "error" | "system";
  message: string;
}

export interface Ticket {
  id: string;
  employeeId: string;
  employeeName: string;
  type: string;
  summary: string;
  status: "open" | "in_progress" | "resolved";
  createdAt: string;
  resolvedAt?: string;
  actions: string[];
}

export interface ActionLogEntry {
  tool: string;
  input: object;
  output: object;
}

const TOOL_LABELS: Record<string, string> = {
  verify_user: "Verifying identity in LDAP",
  unlock_account: "Unlocking account & issuing temp password",
  fix_vpn_connection: "Diagnosing VPN + refreshing certificate",
  request_software: "Checking license pool & assigning",
  log_to_crm: "Writing ticket to CRM",
};

function ts() {
  return new Date().toLocaleTimeString("en-US", { hour12: false });
}
function uid() {
  return Math.random().toString(36).slice(2, 9);
}

export function useVoiceAgent() {
  const [status, setStatus] = useState<AgentStatus>("idle");
  const [consoleLog, setConsoleLog] = useState<ConsoleEntry[]>([
    { id: uid(), timestamp: ts(), type: "system", message: "ARIA v2.5.0 initialized — Adaptive Resolution & Intelligence Agent online." },
    { id: uid(), timestamp: ts(), type: "system", message: "Tools loaded: verify_user, unlock_account, fix_vpn_connection, request_software, log_to_crm" },
    { id: uid(), timestamp: ts(), type: "system", message: "Voice interface ready. Awaiting session start." },
  ]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [transcript, setTranscript] = useState("");
  const [lastResponse, setLastResponse] = useState("");
  const [conversationHistory, setConversationHistory] = useState<object[]>([]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const activeRef = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const addLog = useCallback((type: ConsoleEntry["type"], message: string) => {
    setConsoleLog((prev) => [...prev, { id: uid(), timestamp: ts(), type, message }]);
  }, []);

  // ── Browser TTS ─────────────────────────────────────────────────────────────
  const speakWithBrowser = useCallback((text: string): Promise<void> => {
    return new Promise((resolve) => {
      if (!("speechSynthesis" in window)) { resolve(); return; }
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      const voices = window.speechSynthesis.getVoices();
      const preferred = voices.find((v) => v.name.includes("Samantha") || v.name.includes("Google US English"));
      if (preferred) utterance.voice = preferred;
      utterance.onend = () => resolve();
      utterance.onerror = () => resolve();
      window.speechSynthesis.speak(utterance);
    });
  }, []);

  // ── ElevenLabs TTS (falls back to browser) ──────────────────────────────────
  const speak = useCallback(async (text: string): Promise<void> => {
    const apiKey = process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY;
    if (!apiKey) return speakWithBrowser(text);
    try {
      const res = await fetch(
        "https://api.elevenlabs.io/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM/stream",
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "xi-api-key": apiKey },
          body: JSON.stringify({
            text,
            model_id: "eleven_turbo_v2",
            voice_settings: { stability: 0.45, similarity_boost: 0.85, style: 0.3, use_speaker_boost: true },
          }),
        }
      );
      if (!res.ok) return speakWithBrowser(text);
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
      return speakWithBrowser(text);
    }
  }, [speakWithBrowser]);

  // ── Call agent ───────────────────────────────────────────────────────────────
  const callAgent = useCallback(async (userTranscript: string) => {
    setStatus("thinking");
    addLog("think", `Processing: "${userTranscript}"`);
    addLog("think", "Analyzing intent and selecting tools...");
    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: userTranscript, conversationHistory }),
      });
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const data = await res.json();

      if (data.actionLog?.length) {
        for (const entry of data.actionLog as ActionLogEntry[]) {
          addLog("action", `[TOOL] ${entry.tool} → ${TOOL_LABELS[entry.tool] ?? entry.tool}`);
          const out = entry.output as Record<string, unknown>;
          if (out.success === false) {
            addLog("error", `[FAIL] ${out.error ?? out.message ?? "Unknown error"}`);
          } else {
            addLog("result", `[OK] ${(out.message as string) ?? "[Done]"}`);
          }
        }
      }
      if (data.newTickets?.length) {
        setTickets((prev) => [...prev, ...data.newTickets]);
        for (const t of data.newTickets as Ticket[]) {
          addLog("result", `[CRM] Ticket ${t.id} logged — ${t.summary}`);
        }
      }
      if (data.updatedHistory) setConversationHistory(data.updatedHistory);

      const reply: string = data.response ?? "I've completed the requested actions.";
      setLastResponse(reply);
      addLog("speak", `[ARIA] ${reply}`);
      setStatus("speaking");
      await speak(reply);
      if (activeRef.current) startListening(); else setStatus("idle");
    } catch (err) {
      addLog("error", `[ERROR] ${err instanceof Error ? err.message : "Unknown"}`);
      setStatus("error");
      await speak("I encountered an error. Please try again.");
      if (activeRef.current) startListening();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationHistory, addLog, speak]);

  // ── Speech recognition ───────────────────────────────────────────────────────
  const startListening = useCallback(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SR) { addLog("error", "[ERROR] Use Chrome or Edge for voice support."); setStatus("error"); return; }
    const r = new SR();
    r.lang = "en-US"; r.interimResults = false; r.maxAlternatives = 1; r.continuous = false;
    r.onstart = () => { setStatus("listening"); addLog("listen", "[MIC] Listening..."); };
    r.onresult = (e: Event) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const text = (e as any).results[0][0].transcript;
      setTranscript(text);
      addLog("listen", `[USER] "${text}"`);
      r.stop();
      callAgent(text);
    };
    r.onerror = (e: Event) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const err = (e as any).error;
      if (err === "no-speech") { if (activeRef.current) startListening(); }
      else { addLog("error", `[MIC] ${err}`); setStatus("error"); }
    };
    r.onend = () => { recognitionRef.current = null; };
    recognitionRef.current = r;
    r.start();
  }, [addLog, callAgent]);

  const startSession = useCallback(() => {
    if (activeRef.current) return;
    activeRef.current = true;
    addLog("system", "━━━━━━ SESSION STARTED ━━━━━━");
    speak("Hello! I'm ARIA, your IT Support Agent. How can I help you today?").then(() => {
      if (activeRef.current) startListening();
    });
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

  return { status, consoleLog, tickets, transcript, lastResponse, startSession, stopSession, clearLogs, isActive: activeRef };
}
