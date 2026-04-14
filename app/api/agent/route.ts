// app/api/agent/route.ts — ARIA v4.1
// Fix: extract name/contact from opening message, never re-ask for given info

import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import {
  vapingCases, generateCaseId, VAPING_KNOWLEDGE,
  offenderCases, type VapingCase, type OffenderCase,
} from "@/lib/vaping-systems";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1").replace(/\*(.+?)\*/g, "$1")
    .replace(/`(.+?)`/g, "$1").replace(/#{1,6}\s+/g, "")
    .replace(/\[(.+?)\]\(.+?\)/g, "$1").replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+\.\s+/gm, "").replace(/_{1,2}(.+?)_{1,2}/g, "$1")
    .replace(/>\s+/g, "").replace(/\n{3,}/g, "\n\n").trim();
}

// ── Tools ─────────────────────────────────────────────────────────────────────
const tools: Anthropic.Tool[] = [
  {
    name: "search_vaping_info",
    description: "Search Singapore vaping knowledge base for laws, health effects, penalties, business rules, and reporting guidance. Always call before answering vaping questions.",
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
        identifier: { type: "string", description: "NRIC (e.g. S8712123A) or case reference (e.g. OFC-2024-0891)" },
      },
      required: ["identifier"],
    },
  },
  {
    name: "log_callback_case",
    description: "Log a callback case for officer follow-up. Call this as soon as you have the caller's name AND contact number — do not wait for more information. The query field should summarise what the caller needs based on the full conversation.",
    input_schema: {
      type: "object",
      properties: {
        name:         { type: "string", description: "Caller's full name" },
        contact:      { type: "string", description: "Caller's phone number" },
        email:        { type: "string", description: "Email address (optional)" },
        query:        { type: "string", description: "Summary of what the caller needs help with" },
        callbackTime: { type: "string", description: "Preferred callback time (optional)" },
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
  return JSON.stringify({
    success: true, query,
    information: (match ? match[0] : kb).trim(),
    source: "Singapore HSA & NEA 2024",
  });
}

function handle_lookup_offender(identifier: string): string {
  const id = identifier.trim().toUpperCase().replace(/\s/g, "");
  const found = offenderCases.find(c => c.nricFull.toUpperCase() === id) ??
                offenderCases.find(c => c.caseRef.toUpperCase() === id);
  if (!found) {
    return JSON.stringify({
      success: false,
      error: `No case found for ${identifier}. Please check your NRIC or case reference number. If you believe this is an error, call HSA at 1800-117-8333.`,
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

function handle_log_case(name: string, contact: string, query: string, email?: string, callbackTime?: string): { json: string; case: VapingCase } {
  const newCase: VapingCase = {
    id: generateCaseId(), name, contact, email, query,
    callbackTime: callbackTime ?? "Any time",
    status: "open",
    createdAt: new Date().toISOString(),
    notes: "Logged via ARIA voice assistant. Awaiting officer assignment.",
  };
  vapingCases.push(newCase);
  return {
    case: newCase,
    json: JSON.stringify({
      success: true, case: newCase,
      message: `Case logged. Reference number is ${newCase.id}. An officer will contact ${name} at ${contact}${callbackTime ? ` during ${callbackTime}` : " at the earliest opportunity"}. Please save this reference number.`,
    }),
  };
}

function handle_get_status(case_id: string): string {
  const found = vapingCases.find(c => c.id.toLowerCase() === case_id.toLowerCase());
  if (!found) return JSON.stringify({ success: false, error: `No callback case found with reference ${case_id}.` });
  return JSON.stringify({ success: true, case: found, message: `Callback case ${found.id} for ${found.name} is ${found.status.replace("_"," ")}. Query: ${found.query}` });
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

ABSOLUTE RULES — MUST FOLLOW EXACTLY:

RULE 1 — EXTRACT INFORMATION FROM WHAT THE CALLER SAYS:
- Read every message carefully for name, phone number, email, and callback preference.
- If the caller says "I am Sarah" or "My name is Sarah" or "This is Sarah" — their name is Sarah. Use it immediately.
- If the caller says "I am Sarah, I want a callback" — you already have their name. Do NOT ask for it again.
- If the caller gives name and phone number in one message — call log_callback_case immediately without asking anything else.
- NEVER ask for information the caller has already provided in this conversation.

RULE 2 — CALLBACK CASE COLLECTION SEQUENCE:
- Step 1: You need the caller's name. Check if they already gave it. If yes, skip to Step 2.
- Step 2: You need their contact number. Ask for it if not given.
- Step 3: Once you have name AND contact number — call log_callback_case IMMEDIATELY. Do not ask for email or callback time unless the caller volunteers it.
- The query field should be a summary of what the caller told you they need help with.

RULE 3 — CONVERSATION CONTINUITY:
- This is a continuous conversation. You have full memory of everything said.
- NEVER re-introduce yourself after the first message.
- NEVER say Hello or How can I help after the first turn.
- Vary your responses — never repeat the same phrasing.

RULE 4 — VOICE FORMATTING:
- No markdown. No asterisks, bold, bullets, or symbols. Plain spoken sentences only.
- Keep responses to 2 sentences maximum per turn.
- After completing an action, confirm it briefly and stop. Do not add unnecessary follow-up questions.

RULE 5 — INFORMATION SEARCH:
- Always call search_vaping_info before answering vaping law or health questions.
- Never answer from memory alone on regulatory matters.`;

    const messages: Anthropic.MessageParam[] = [
      ...(conversationHistory as Anthropic.MessageParam[]),
      { role: "user", content: transcript },
    ];

    const actionLog: Array<{ tool: string; input: object; output: object }> = [];
    const newCases: VapingCase[] = [];
    const offenderResults: OffenderCase[] = [];
    let finalResponse = "";
    let iterations = 0;

    while (iterations < 6) {
      iterations++;
      const response = await anthropic.messages.create({
        model: "claude-opus-4-5",
        max_tokens: 250, // Short responses — voice assistant, not a chatbot
        system,
        tools,
        messages,
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
            const { case: logged, json } = handle_log_case(
              input.name as string, input.contact as string, input.query as string,
              input.email as string | undefined, input.callbackTime as string | undefined
            );
            newCases.push(logged);
            actionLog.push({ tool: block.name, input, output: JSON.parse(json) });
            resultJson = json;

          } else if (block.name === "get_case_status") {
            resultJson = handle_get_status(input.case_id as string);
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
