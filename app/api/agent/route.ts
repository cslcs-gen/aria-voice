// app/api/agent/route.ts — ARIA Vaping Assistant v3.2
// Fix: stateless case collection via conversation, no hanging tool calls

import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import {
  vapingCases,
  generateCaseId,
  VAPING_KNOWLEDGE,
  type VapingCase,
} from "@/lib/vaping-systems";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── Strip markdown so TTS never reads symbols ─────────────────────────────────
function stripMarkdown(text: string): string {
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
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ── Tools ─────────────────────────────────────────────────────────────────────
const tools: Anthropic.Tool[] = [
  {
    name: "search_vaping_info",
    description: "Search the Singapore vaping knowledge base. Call this for ANY vaping question before answering.",
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
    name: "log_callback_case",
    description: "Log a callback case. ONLY call this tool when you already have the caller's name AND contact number from earlier in the conversation. Never ask for information you already have. If you have name and contact, log immediately without asking more questions unless the caller volunteers additional details.",
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
    description: "Get status of a logged case by reference number.",
    input_schema: {
      type: "object",
      properties: { case_id: { type: "string" } },
      required: ["case_id"],
    },
  },
  {
    name: "list_all_cases",
    description: "List all logged callback cases.",
    input_schema: {
      type: "object",
      properties: { status_filter: { type: "string", enum: ["all","open","in_progress","resolved"] } },
      required: ["status_filter"],
    },
  },
];

// ── Tool handlers ─────────────────────────────────────────────────────────────
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
  const info  = match ? match[0] : kb;
  return JSON.stringify({ success: true, query, information: info.trim(), source: "Singapore HSA & NEA 2024" });
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
  if (!found) return JSON.stringify({ success: false, error: `No case found with reference ${case_id}.` });
  return JSON.stringify({ success: true, case: found, message: `Case ${found.id} for ${found.name} is ${found.status.replace("_"," ")}. Query: ${found.query}` });
}

function handle_list_cases(status_filter: string): string {
  const list = status_filter === "all" ? vapingCases : vapingCases.filter(c => c.status === status_filter);
  return JSON.stringify({ success: true, total: list.length, cases: list.map(c => ({ id: c.id, name: c.name, status: c.status, query: c.query })) });
}

// ── POST handler ──────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const { transcript, conversationHistory = [] } = await req.json();
    if (!transcript?.trim()) return NextResponse.json({ error: "No transcript." }, { status: 400 });

    const system = `You are ARIA, a friendly and professional public health voice assistant for Singapore's vaping enforcement and education helpline.

YOUR PURPOSE:
Answer questions about Singapore vaping laws, health effects, business regulations, and how to report violations. When a caller needs personalised help or wants an officer callback, collect their details and log a case.

STRICT CONVERSATION RULES — READ CAREFULLY:
1. This is a continuous multi-turn conversation. You have FULL memory of everything said.
2. NEVER re-introduce yourself or say "Hello, I am ARIA" after the first message.
3. NEVER use markdown. No asterisks, bold, bullet points, hyphens as lists, or pound signs. Plain spoken sentences only.
4. Do not say "asterisk" or any punctuation symbol aloud.
5. Keep responses short — 1 to 3 sentences maximum per turn.
6. Always search for information before answering vaping questions.

CASE COLLECTION — CRITICAL RULES:
- When a caller wants a callback, ask for ONE piece of information per turn in this order:
  Step 1: Ask for their full name only.
  Step 2: Once you have the name, ask for their contact number only.
  Step 3: Once you have name and contact number, IMMEDIATELY call log_callback_case. Do not ask for more information unless the caller offers it.
- If the caller gives you name and number in the same message, call log_callback_case immediately.
- NEVER ask for the same information twice.
- NEVER ask for email or callback time before logging — only collect those if the caller volunteers them spontaneously.
- After logging, confirm the reference number in one clear sentence.
- The query field should summarise what the caller needs help with based on the conversation.

IMPORTANT: Your job during case collection is to be fast and simple. Two pieces of information (name + contact) are enough to log. Log immediately when you have them.`;

    // Keep full history — never truncate during an active case collection flow
    const messages: Anthropic.MessageParam[] = [
      ...(conversationHistory as Anthropic.MessageParam[]),
      { role: "user", content: transcript },
    ];

    const actionLog: Array<{ tool: string; input: object; output: object }> = [];
    const newCases: VapingCase[] = [];
    let finalResponse = "";
    let iterations = 0;
    const MAX_ITERATIONS = 6; // Safety limit to prevent infinite loops

    while (iterations < MAX_ITERATIONS) {
      iterations++;

      const response = await anthropic.messages.create({
        model: "claude-opus-4-5",
        max_tokens: 300, // Short responses prevent hanging
        system,
        tools,
        messages,
      });

      if (response.stop_reason === "end_turn") {
        const text = response.content.find(b => b.type === "text") as Anthropic.TextBlock | undefined;
        finalResponse = text ? stripMarkdown(text.text) : "";
        // Add assistant response to history
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

          } else if (block.name === "list_all_cases") {
            resultJson = handle_list_cases(input.status_filter as string);
            actionLog.push({ tool: block.name, input, output: JSON.parse(resultJson) });

          } else {
            resultJson = JSON.stringify({ error: `Unknown tool: ${block.name}` });
          }

          toolResults.push({ type: "tool_result", tool_use_id: block.id, content: resultJson });
        }

        messages.push({ role: "user", content: toolResults });
        continue;
      }

      // Any other stop reason — break safely
      break;
    }

    // If we hit max iterations without a response, provide a fallback
    if (!finalResponse) {
      finalResponse = "I am sorry, I was unable to complete that request. Please try again or rephrase your question.";
    }

    // Return updated history — cap at 40 to stay within limits
    const updatedHistory = messages.slice(-40);

    return NextResponse.json({ response: finalResponse, actionLog, newCases, updatedHistory });

  } catch (err) {
    console.error("[ARIA Error]", err);
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({
      response: "I encountered a technical issue. Please try again in a moment.",
      actionLog: [],
      newCases: [],
      updatedHistory: [],
      error: msg,
    }, { status: 200 }); // Return 200 so client handles gracefully
  }
}
