// hooks/useVoiceAgent.ts — Voice + Agent Orchestrator

"use client";

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
    {
      id: uid(),
      timestamp: ts(),
      type: "system",
      message: "ARIA v2.4.1 initialized — Autonomous Resolution & IT Agent online.",
    },
    {
      id: uid(),
      timestamp: ts(),
      type: "system",
      message: "Tools loaded: verify_user, unlock_account, fix_vpn_connection, request_software, log_to_crm",
    },
    {
      id: uid(),
      timestamp: ts(),
      type: "system",
      message: "Voice interface ready. Awaiting session start.",
    },
  ]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [transcript, setTranscript] = useState("");
  const [lastResponse, setLastResponse] = useState("");
  const [conversationHistory, setConversationHistory] = useState<object[]>([]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const synthRef = useRef<any>(null);
  const activeRef = useRef(false);

  const addLog = useCallback((type: ConsoleEntry["type"], message: string) => {
    setConsoleLog((prev) => [
      ...prev,
      { id: uid(), timestamp: ts(), type, message },
    ]);
  }, []);

  // ── Speak response ──────────────────────────────────────────────────────────
  const speak = useCallback(
    (text: string): Promise<void> => {
      return new Promise((resolve) => {
        if (!("speechSynthesis" in window)) {
          resolve();
          return;
        }
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1.05;
        utterance.pitch = 1.0;
        utterance.volume = 1.0;
        // Prefer a natural-sounding voice
        const voices = window.speechSynthesis.getVoices();
        const preferred = voices.find(
          (v) =>
            v.name.includes("Samantha") ||
            v.name.includes("Google US English") ||
            v.name.includes("en-US")
        );
        if (preferred) utterance.voice = preferred;
        utterance.onend = () => resolve();
        utterance.onerror = () => resolve();
        window.speechSynthesis.speak(utterance);
      });
    },
    []
  );

  // ── Call the agent API ──────────────────────────────────────────────────────
  const callAgent = useCallback(
    async (userTranscript: string) => {
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

        // Process action log → console entries
        if (data.actionLog?.length) {
          for (const entry of data.actionLog as ActionLogEntry[]) {
            const label = TOOL_LABELS[entry.tool] ?? entry.tool;
            addLog("action", `[TOOL] ${entry.tool} → ${label}`);
            const out = entry.output as Record<string, unknown>;
            if (out.success === false) {
              addLog("error", `[FAIL] ${out.error ?? out.message ?? "Unknown error"}`);
            } else {
              const msg =
                (out.message as string) ??
                (out.currentStatus ? `Status: ${out.currentStatus}` : null) ??
                "[OK]";
              addLog("result", `[OK] ${msg}`);
            }
          }
        }

        // New tickets
        if (data.newTickets?.length) {
          setTickets((prev) => [...prev, ...data.newTickets]);
          for (const t of data.newTickets as Ticket[]) {
            addLog("result", `[CRM] Ticket ${t.id} logged — ${t.summary}`);
          }
        }

        // Update history
        if (data.updatedHistory) {
          setConversationHistory(data.updatedHistory);
        }

        const agentReply: string = data.response ?? "I've completed the requested actions.";
        setLastResponse(agentReply);
        addLog("speak", `[ARIA] ${agentReply}`);

        // Speak the response
        setStatus("speaking");
        await speak(agentReply);

        // If session still active, go back to listening
        if (activeRef.current) {
          startListening();
        } else {
          setStatus("idle");
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        addLog("error", `[ERROR] ${msg}`);
        setStatus("error");
        await speak("I encountered an error processing your request. Please try again.");
        if (activeRef.current) startListening();
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [conversationHistory, addLog, speak]
  );

  // ── Start listening ─────────────────────────────────────────────────────────
  const startListening = useCallback(() => {
    if (!("webkitSpeechRecognition" in window || "SpeechRecognition" in window)) {
      addLog("error", "[ERROR] Web Speech API not supported in this browser.");
      setStatus("error");
      return;
    }

    const SpeechRecognition =
      (window as Window & typeof globalThis & { webkitSpeechRecognition?: typeof window.SpeechRecognition }).webkitSpeechRecognition ??
      window.SpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.continuous = false;

    recognition.onstart = () => {
      setStatus("listening");
      addLog("listen", "[MIC] Listening — speak now...");
    };

    recognition.onresult = (event: Event) => {
     const speechEvent = event as unknown as { results: SpeechRecognitionResultList };
     const text = speechEvent.results[0][0].transcript;
     setTranscript(text);
     addLog("listen", `[USER] "${text}"`);
     recognition.stop();
     callAgent(text);
    };


    recognition.onerror = (event: Event) => {
      const errEvent = event as unknown as { error: string };
      if (errEvent.error === "no-speech") {
         addLog("system", "[MIC] No speech detected, retrying...");
         if (activeRef.current) startListening();
         } else {
           addLog("error", `[MIC ERROR] ${errEvent.error}`);
      setStatus("error");
      }
    };

    recognition.onend = () => {
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [addLog, callAgent]);

  // ── Session controls ────────────────────────────────────────────────────────
  const startSession = useCallback(() => {
    if (activeRef.current) return;
    activeRef.current = true;
    addLog("system", "━━━━━━ SESSION STARTED ━━━━━━");
    addLog("system", "ARIA is now active. How can I help you today?");
    speak("Hello! I'm ARIA, your IT Support Agent. How can I help you today?").then(() => {
      if (activeRef.current) startListening();
    });
  }, [addLog, speak, startListening]);

  const stopSession = useCallback(() => {
    activeRef.current = false;
    recognitionRef.current?.stop();
    window.speechSynthesis?.cancel();
    setStatus("idle");
    addLog("system", "━━━━━━ SESSION ENDED ━━━━━━");
  }, [addLog]);

  const clearLogs = useCallback(() => {
    setConsoleLog([
      {
        id: uid(),
        timestamp: ts(),
        type: "system",
        message: "Console cleared. ARIA ready.",
      },
    ]);
  }, []);

  return {
    status,
    consoleLog,
    tickets,
    transcript,
    lastResponse,
    startSession,
    stopSession,
    clearLogs,
    isActive: activeRef,
  };
}
