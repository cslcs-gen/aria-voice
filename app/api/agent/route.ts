// app/api/agent/route.ts — ARIA v5.1 with Redis persistence

import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import {
  offenderCases, VAPING_KNOWLEDGE,
  type OffenderCase,
} from "@/lib/vaping-systems";
import { saveCase, type StoredCase } from "@/lib/redis";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1").replace(/\*(.+?)\*/g, "$1")
    .replace(/`(.+?)`/g, "$1").replace(/#{1,6}\s+/g, "")
    .replace(/\[(.+?)\]\(.+?\)/g, "$1").replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+\.\s+/gm, "").replace(/_{1,2}(.+?)_{1,2}/g, "$1")
    .replace(/>\s+/g, "").replace(/\n{3,}/g, "\n\n").trim();
}

function generateCaseId(): string {
  const d = new Date();
  const ds = d.getFullYear().toString() +
    String(d.getMonth() + 1).padStart(2, "0") +
    String(d.getDate()).padStart(2, "0");
  return `VPG-${ds}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

// ── Tools ─────────────────────────────────────────────────────────────────────
const tools: Anthropic.Tool[] = [
  {
    name: "search_vaping_info",
    description: "Search Singapore vaping knowledge base. Always call before answering vaping questions.",
    input_schema: {
      type: "object",
      properties: {
        query:    { type: "string" },
        category: { type: "string", enum: ["laws_penalties","health_effects","how_to_report","business_regulations","general_faq","all"] },
      },
      required: ["query","category"],
    },
  },
  {
    name: "lookup_offender_case",
    description: "Look up an offender enforcement case by NRIC or case reference number.",
    input_schema: {
      type: "object",
      properties: {
        identifier: { type: "string" },
      },
      required: ["identifier"],
    },
  },
  {
    name: "log_callback_case",
    description: "Log a callback case. Call immediately when you have name AND contact number.",
    input_schema: {
      type: "object",
      properties: {
        name:         { type: "string" },
        contact:      { type: "string" },
        email:        { type: "string" },
        query:        { type: "string" },
        callbackTime: { type: "string" },
      },
      required: ["name","contact","query"],
    },
  },
  {
    name: "get_case_status",
    description: "Get status of a logged callback case by reference number.",
    input_schema: {
      type: "object",
      properties: { case_id: { type: "string" } },
      required: ["case_id"],
    },
  },
];

// ── Tool implementations ──────────────────────────────────────────────────────
function handle_search(query: string, category: string): string {
  const kb = VAPING_KNOWLEDGE;
  const sectionMap: Record<string, RegExp> = {
    laws_penalties:       /## Singapore Vaping Laws[\s\S]*?(?=\n##|$)/,
    health_effects:       /## Health Effects[\s\S]*?(?=\n##|$)/,
    how_to_report:        /## How to Report[\s\S]*?(?=\n##|$)/,
    business_regulations: /## Vaping Regulations for Businesses[\s\S]*?(?=\n##|$)/,
    general_faq:          /## Frequently Asked Questions[\s\S]*?(?=\n##|$)/,
  };
  const regex = sectionMap[category];
  const match = regex ? kb.match(regex) : null;
  return JSON.stringify({ success: true, query, information: (match ? match[0] : kb).trim(), source: "Singapore HSA & NEA 2024" });
}

function handle_lookup_offender(identifier: string): string {
  const id = identifier.trim().toUpperCase().replace(/[\s\-\.]/g, "");
  let found = offenderCases.find(c => c.nricFull.toUpperCase() === id);
  if (!found) found = offenderCases.find(c => c.caseRef.toUpperCase() === id);
  if (!found) {
    found = offenderCases.find(c => {
      const nric = c.nricFull.toUpperCase().replace(/[\s\-]/g, "");
      const ref  = c.caseRef.toUpperCase().replace(/[\s\-]/g, "");
      return nric === id || ref === id || nric.includes(id) || ref.includes(id) || id.includes(nric) || id.includes(ref);
    });
  }
  if (!found) {
    const digitsOnly = id.replace(/[^0-9]/g, "");
    if (digitsOnly.length >= 5) {
      found = offenderCases.find(c => c.nricFull.replace(/[^0-9]/g, "") === digitsOnly);
    }
  }
  if (!found) {
    return JSON.stringify({
      success: false,
      error: `No case found for "${identifier}". Demo NRICs: S8712123A, T9234890B, S7845456C, G9912789D.`,
    });
  }
  const penaltyParts: string[] = [];
  if (found.penalties.fine) penaltyParts.push(`Fine of SGD ${found.penalties.fine.amount.toLocaleString()} ${found.penalties.fine.paid ? "(paid)" : `(due ${found.penalties.fine.dueDate})`}`);
  if (found.penalties.rehabilitation) penaltyParts.push(`Rehabilitation: ${found.penalties.rehabilitation.programme} — ${found.penalties.rehabilitation.completedSessions} of ${found.penalties.rehabilitation.sessions} sessions — ${found.penalties.rehabilitation.status}`);
  if (found.penalties.jailTerm) penaltyParts.push(`Custodial sentence: ${found.penalties.jailTerm.duration} at ${found.penalties.jailTerm.facility} — ${found.penalties.jailTerm.status} — release: ${found.penalties.jailTerm.releaseDate}`);
  const tierLabel = found.penaltyTier === 1 ? "Tier 1 First Offence" : found.penaltyTier === 2 ? "Tier 2 Repeat Offence" : "Tier 3 Serious Offence";
  return JSON.stringify({
    success: true, case: found,
    summary: `Case ${found.caseRef} for ${found.name}. Offence: ${found.offenceType} on ${found.offenceDate} at ${found.location}. Penalty tier: ${tierLabel}. Penalties: ${penaltyParts.join("; ")}. Status: ${found.status}. Next action: ${found.nextAction}. Case officer: ${found.caseOfficer}.`,
    penaltySummary: penaltyParts, tierLabel,
  });
}

async function handle_log_case(
  name: string, contact: string, query: string,
  email?: string, callbackTime?: string
): Promise<{ json: string; case: StoredCase }> {
  const newCase: StoredCase = {
    id: generateCaseId(), name, contact, email, query,
    callbackTime: callbackTime ?? "Any time",
    status: "open",
    createdAt: new Date().toISOString(),
    notes: "Logged via ARIA voice assistant. Awaiting officer assignment.",
  };

  // Persist to Redis — shared across all serverless instances
  await saveCase(newCase);

  // Send Telegram notification
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://aria-voice-seven.vercel.app";
  fetch(`${appUrl}/api/telegram/notify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      caseId: newCase.id, name, contact, email, query, callbackTime,
    }),
  }).catch(err => console.error("[Telegram Notify Failed]", err));

  return {
    case: newCase,
    json: JSON.stringify({
      success: true, case: newCase,
      message: `Case logged. Reference number is ${newCase.id}. An officer has been notified via Telegram and will contact ${name} at ${contact}${callbackTime ? ` during ${callbackTime}` : " at the earliest opportunity"}. Please save your reference number.`,
    }),
  };
}

function handle_get_status_sync(case_id: string): string {
  // Returns a pending message — actual lookup happens async via /api/cases
  return JSON.stringify({
    success: true,
    message: `Please check the Callback Cases page for the latest status of case ${case_id}.`,
  });
}

// ── POST ──────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const { transcript, conversationHistory = [] } = await req.json();
    if (!transcript?.trim()) return NextResponse.json({ error: "No transcript." }, { status: 400 });

    const system = `You are ARIA, a friendly and professional public health voice assistant for Singapore's vaping enforcement and education helpline.

YOUR CAPABILITIES:
1. Answer questions about Singapore vaping laws, health effects, reporting, and business regulations.
2. Look up offender enforcement cases by NRIC or case reference number.
3. Log callback cases for callers who need officer assistance.

LANGUAGE RULE — CRITICAL:
- If the caller writes or speaks in Chinese, respond entirely in Simplified Chinese.
- If the caller writes or speaks in English, respond entirely in English.
- Never mix languages.

ABSOLUTE RULES:
1. Case lookup: when caller mentions NRIC or case ref, call lookup_offender_case immediately. Do not validate format.
2. Extract info: if caller says "I am Sarah", name is Sarah — use it, do not ask again.
3. Callback collection: ask name → contact → log immediately. Do not ask for email unless offered.
4. Never re-introduce yourself after the first message.
5. No markdown. Plain spoken sentences only. Max 2 sentences per turn.
6. Always search before answering vaping questions.
7. After logging a case, tell the caller their reference number and that an officer has been notified.`;

    const messages: Anthropic.MessageParam[] = [
      ...(conversationHistory as Anthropic.MessageParam[]),
      { role: "user", content: transcript },
    ];

    const actionLog: Array<{ tool: string; input: object; output: object }> = [];
    const newCases: StoredCase[] = [];
    const offenderResults: OffenderCase[] = [];
    let finalResponse = "";
    let iterations = 0;

    while (iterations < 6) {
      iterations++;
      const response = await anthropic.messages.create({
        model: "claude-opus-4-5",
        max_tokens: 250,
        system, tools, messages,
      });

      if (response.stop_reason === "end_turn") {
        const text = response.content.find(b => b.type === "text") as Anthropic.TextBlock | undefined;
        finalResponse = text ? stripMarkdown(text.text) : "";
        messages.push({ role: "assistant", content: response.content });
        break;
      }

      if (response.stop_reason === "tool_use") {
        messages.push({ role: "assistant", content: response.content });
        const toolResults: Anthropic.ToolResultBlockParam[] = [];

        for (const block of response.content) {
          if (block.type !== "tool_use") continue;
          const input = block.input as Record<string, unknown>;
          let resultJson = "";

          if (block.name === "search_vaping_info") {
            resultJson = handle_search(input.query as string, input.category as string);
            actionLog.push({ tool: block.name, input, output: JSON.parse(resultJson) });

          } else if (block.name === "lookup_offender_case") {
            resultJson = handle_lookup_offender(input.identifier as string);
            const parsed = JSON.parse(resultJson);
            actionLog.push({ tool: block.name, input, output: parsed });
            if (parsed.success && parsed.case) offenderResults.push(parsed.case);

          } else if (block.name === "log_callback_case") {
            const { case: logged, json } = await handle_log_case(
              input.name as string, input.contact as string, input.query as string,
              input.email as string | undefined, input.callbackTime as string | undefined
            );
            newCases.push(logged);
            actionLog.push({ tool: block.name, input, output: JSON.parse(json) });
            resultJson = json;

          } else if (block.name === "get_case_status") {
            resultJson = handle_get_status_sync(input.case_id as string);
            actionLog.push({ tool: block.name, input, output: JSON.parse(resultJson) });

          } else {
            resultJson = JSON.stringify({ error: `Unknown tool: ${block.name}` });
          }

          toolResults.push({ type: "tool_result", tool_use_id: block.id, content: resultJson });
        }

        messages.push({ role: "user", content: toolResults });
        continue;
      }
      break;
    }

    if (!finalResponse) {
      finalResponse = "I am sorry, I was unable to complete that request. Please try again.";
    }

    return NextResponse.json({
      response: finalResponse,
      actionLog,
      newCases,
      offenderResults,
      updatedHistory: messages.slice(-40),
    });

  } catch (err) {
    console.error("[ARIA Error]", err);
    return NextResponse.json({
      response: "I encountered a technical issue. Please try again in a moment.",
      actionLog: [], newCases: [], offenderResults: [], updatedHistory: [],
    }, { status: 200 });
  }
}
