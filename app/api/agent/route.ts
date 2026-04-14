// app/api/agent/route.ts — ARIA v4.0
// Added: lookup_offender_case tool for voice-based offender case retrieval

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
    description: "Look up an offender's enforcement case by NRIC number or case reference number. Use when someone asks about their case, their fine, their jail term, their rehabilitation programme, or says their NRIC or case reference number.",
    input_schema: {
      type: "object",
      properties: {
        identifier: { type: "string", description: "NRIC number (e.g. S8712123A) or case reference (e.g. OFC-2024-0891)" },
      },
      required: ["identifier"],
    },
  },
  {
    name: "log_callback_case",
    description: "Log a callback case when user needs officer follow-up. Call ONLY when you have name AND contact number. Log immediately — do not ask for extra info beyond name and contact.",
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
  const id = identifier.trim().toUpperCase().replace(/\s/g, "");

  // Try NRIC match first (case-insensitive full NRIC)
  let found: OffenderCase | undefined = offenderCases.find(
    c => c.nricFull.toUpperCase() === id
  );

  // Try case reference match
  if (!found) {
    found = offenderCases.find(
      c => c.caseRef.toUpperCase() === id
    );
  }

  if (!found) {
    return JSON.stringify({
      success: false,
      error: `No case found for ${identifier}. Please check your NRIC or case reference number and try again. If you believe this is an error, please call HSA at 1800-117-8333.`,
    });
  }

  // Build a spoken-friendly summary
  const f = found;
  const penaltyParts: string[] = [];
  if (f.penalties.fine) {
    penaltyParts.push(`Fine of SGD ${f.penalties.fine.amount.toLocaleString()} ${f.penalties.fine.paid ? "(paid)" : `(due ${f.penalties.fine.dueDate})`}`);
  }
  if (f.penalties.rehabilitation) {
    penaltyParts.push(`Rehabilitation: ${f.penalties.rehabilitation.programme} — ${f.penalties.rehabilitation.completedSessions} of ${f.penalties.rehabilitation.sessions} sessions completed — status: ${f.penalties.rehabilitation.status}`);
  }
  if (f.penalties.jailTerm) {
    penaltyParts.push(`Custodial sentence: ${f.penalties.jailTerm.duration} at ${f.penalties.jailTerm.facility} — status: ${f.penalties.jailTerm.status} — expected release: ${f.penalties.jailTerm.releaseDate}`);
  }

  const tierLabel = f.penaltyTier === 1 ? "Tier 1 — First Offence" : f.penaltyTier === 2 ? "Tier 2 — Repeat Offence / Enhanced" : "Tier 3 — Serious Offence";

  return JSON.stringify({
    success: true,
    case: f,
    summary: `Case ${f.caseRef} for ${f.name}. Offence: ${f.offenceType} on ${f.offenceDate} at ${f.location}. Penalty tier: ${tierLabel}. Penalties: ${penaltyParts.join("; ")}. Case status: ${f.status}. Next action: ${f.nextAction}. Case officer: ${f.caseOfficer}.`,
    penaltySummary: penaltyParts,
    tierLabel,
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
3. Log callback cases for members of the public who need officer assistance.

STRICT RULES — READ CAREFULLY:
1. Continuous conversation — you have FULL memory. NEVER re-introduce yourself after the first message.
2. No markdown. No asterisks, bold, bullets, or symbols. Plain spoken sentences only.
3. Keep responses to 2 to 3 sentences per turn maximum.
4. Always search before answering vaping information questions.
5. For offender case lookup: when someone mentions their NRIC or case reference, immediately call lookup_offender_case. Confirm the masked NRIC back to them before sharing full details.
6. For callback cases: ask name, then contact number. Log immediately when you have both. Do not delay.
7. After logging or looking up a case, clearly state the reference number and next steps in plain speech.
8. Be empathetic with offenders — they may be stressed. Explain their situation clearly and direct them to their case officer for further help.`;

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
        max_tokens: 350,
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
          }

          toolResults.push({ type: "tool_result", tool_use_id: block.id, content: resultJson });
        }

        messages.push({ role: "user", content: toolResults });
        continue;
      }
      break;
    }

    if (!finalResponse) {
      finalResponse = "I am sorry, I was unable to complete that request. Please try again or rephrase your question.";
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
