// app/api/agent/route.ts — ARIA Vaping Public Health Assistant Brain (v3.1)

import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import {
  vapingCases,
  generateCaseId,
  VAPING_KNOWLEDGE,
  type VapingCase,
} from "@/lib/vaping-systems";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── Strip markdown so TTS doesn't read symbols aloud ─────────────────────────
function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1")   // bold
    .replace(/\*(.+?)\*/g, "$1")       // italic
    .replace(/`(.+?)`/g, "$1")         // inline code
    .replace(/#{1,6}\s+/g, "")         // headings
    .replace(/\[(.+?)\]\(.+?\)/g, "$1")// links
    .replace(/^\s*[-*+]\s+/gm, "")     // bullet points
    .replace(/^\s*\d+\.\s+/gm, "")     // numbered lists
    .replace(/_{1,2}(.+?)_{1,2}/g, "$1")// underscores
    .replace(/~~(.+?)~~/g, "$1")       // strikethrough
    .replace(/>\s+/g, "")              // blockquotes
    .replace(/\n{3,}/g, "\n\n")        // excess newlines
    .trim();
}

// ── Tool Definitions ──────────────────────────────────────────────────────────
const tools: Anthropic.Tool[] = [
  {
    name: "search_vaping_info",
    description:
      "Search the Singapore vaping knowledge base for laws, health effects, penalties, business regulations, and how to report violations. Always call this before answering any vaping question.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "The vaping question or topic to look up" },
        category: {
          type: "string",
          enum: ["laws_penalties", "health_effects", "how_to_report", "business_regulations", "general_faq", "all"],
        },
      },
      required: ["query", "category"],
    },
  },
  {
    name: "log_callback_case",
    description:
      "Log a callback case after collecting ALL required information from the caller. Only call this tool once you have: name, contact number, query summary. Email and callback time are optional but collect them if offered.",
    input_schema: {
      type: "object",
      properties: {
        name:         { type: "string", description: "Full name of the caller" },
        contact:      { type: "string", description: "Phone number of the caller" },
        email:        { type: "string", description: "Email address (optional)" },
        query:        { type: "string", description: "Summary of the issue needing officer follow-up" },
        callbackTime: { type: "string", description: "Preferred callback time" },
      },
      required: ["name", "contact", "query"],
    },
  },
  {
    name: "get_case_status",
    description: "Retrieve the status of a previously logged callback case by reference number.",
    input_schema: {
      type: "object",
      properties: {
        case_id: { type: "string", description: "Case reference number (e.g. VPG-20240115-AB12)" },
      },
      required: ["case_id"],
    },
  },
  {
    name: "list_all_cases",
    description: "List all logged callback cases. Use when the caller asks to see their cases.",
    input_schema: {
      type: "object",
      properties: {
        status_filter: {
          type: "string",
          enum: ["all", "open", "in_progress", "resolved"],
        },
      },
      required: ["status_filter"],
    },
  },
];

// ── Tool Implementations ──────────────────────────────────────────────────────
function search_vaping_info(query: string, category: string): object {
  const kb = VAPING_KNOWLEDGE;
  let sections = "";

  const sectionMap: Record<string, RegExp> = {
    laws_penalties:       /## Singapore Vaping Laws[\s\S]*?(?=\n##|$)/,
    health_effects:       /## Health Effects[\s\S]*?(?=\n##|$)/,
    how_to_report:        /## How to Report[\s\S]*?(?=\n##|$)/,
    business_regulations: /## Vaping Regulations for Businesses[\s\S]*?(?=\n##|$)/,
    general_faq:          /## Frequently Asked Questions[\s\S]*?(?=\n##|$)/,
  };

  if (category === "all") {
    sections = kb;
  } else {
    const regex = sectionMap[category];
    const match = regex ? kb.match(regex) : null;
    sections = match ? match[0] : kb;
  }

  return {
    success: true,
    query,
    category,
    information: sections.trim(),
    source: "Singapore Health Sciences Authority (HSA) & National Environment Agency (NEA) — 2024",
    disclaimer: "Verify latest regulations at hsa.gov.sg or call HSA at 1800-117-8333.",
  };
}

function log_callback_case(
  name: string, contact: string, query: string,
  email?: string, callbackTime?: string
): object {
  const newCase: VapingCase = {
    id: generateCaseId(),
    name, contact, email, query,
    callbackTime: callbackTime ?? "Any time",
    status: "open",
    createdAt: new Date().toISOString(),
    notes: "Case logged via ARIA voice assistant. Awaiting officer assignment.",
  };
  vapingCases.push(newCase);

  return {
    success: true,
    case: newCase,
    message: `Case successfully logged. Your reference number is ${newCase.id}. An officer will call ${name} at ${contact}${callbackTime ? ` during ${callbackTime}` : " at the earliest opportunity"}. Please save your reference number to track your case.`,
  };
}

function get_case_status(case_id: string): object {
  const found = vapingCases.find((c) => c.id.toLowerCase() === case_id.toLowerCase());
  if (!found) return { success: false, error: `No case found with reference ${case_id}. Please check the number and try again.` };
  return {
    success: true,
    case: found,
    message: `Case ${found.id} for ${found.name} is currently ${found.status.replace("_", " ")}. Query: ${found.query}`,
  };
}

function list_all_cases(status_filter: string): object {
  const filtered = status_filter === "all" ? vapingCases : vapingCases.filter((c) => c.status === status_filter);
  return {
    success: true,
    total: filtered.length,
    cases: filtered.map((c) => ({ id: c.id, name: c.name, contact: c.contact, query: c.query, status: c.status, createdAt: c.createdAt })),
    message: filtered.length === 0 ? "No cases found." : `Found ${filtered.length} case(s).`,
  };
}

function executeTool(name: string, input: Record<string, unknown>): string {
  let result: object;
  switch (name) {
    case "search_vaping_info":
      result = search_vaping_info(input.query as string, input.category as string); break;
    case "log_callback_case":
      result = log_callback_case(input.name as string, input.contact as string, input.query as string, input.email as string | undefined, input.callbackTime as string | undefined); break;
    case "get_case_status":
      result = get_case_status(input.case_id as string); break;
    case "list_all_cases":
      result = list_all_cases(input.status_filter as string); break;
    default:
      result = { error: `Unknown tool: ${name}` };
  }
  return JSON.stringify(result);
}

// ── Agentic Loop ──────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const { transcript, conversationHistory = [] } = await req.json();
    if (!transcript?.trim()) {
      return NextResponse.json({ error: "No transcript provided." }, { status: 400 });
    }

    const systemPrompt = `You are ARIA, a friendly and professional public health voice assistant for Singapore's vaping enforcement and education helpline.

YOUR PURPOSE:
- Answer questions about Singapore vaping laws, penalties, health effects, business regulations, and how to report violations.
- When you cannot fully answer a query, or the caller wants to speak to an officer, collect their details step by step and log a callback case.
- Speak naturally as if on a phone call. Be warm, concise, and reassuring.

CRITICAL CONVERSATION RULES:
1. This is a CONTINUOUS multi-turn conversation. You have FULL memory of everything said so far.
2. NEVER re-introduce yourself or say "Hello" or "How can I help" after the first message. Just continue naturally.
3. NEVER repeat what the caller just said back to them unnecessarily.
4. When collecting information for a case, follow this sequence ONE question at a time:
   - First ask for their full name
   - Then ask for their contact number
   - Then ask for their email address (say it is optional)
   - Then ask for their preferred callback time
   - Then confirm ALL details and log the case
5. If the caller has already given their name in this conversation, DO NOT ask for it again.
6. Keep track of what information you have already collected and only ask for what is still missing.
7. NEVER use markdown formatting. No asterisks, no bold, no bullet points, no hyphens as bullets, no pound signs.
8. Write all responses as plain natural spoken sentences only.
9. Do not say "asterisk", do not read symbols, do not use special characters in any response.
10. Always end with a brief natural follow-up like "Is there anything else I can help you with?"

CASE COLLECTION MEMORY:
- Store the caller's name, contact, email, and callback time as they provide them during the conversation.
- Only call log_callback_case when you have at minimum: name and contact number.
- After logging, clearly state the reference number and next steps in plain speech.

INFORMATION RULES:
- Always use search_vaping_info before answering vaping questions.
- Keep answers concise for voice — 2 to 3 sentences maximum per point.
- Recommend callers verify at hsa.gov.sg or call HSA at 1800-117-8333 for the latest updates.`;

    // Build messages — preserve full history to maintain case collection context
    const history = (conversationHistory as Anthropic.MessageParam[]);
    const messages: Anthropic.MessageParam[] = [
      ...history,
      { role: "user", content: transcript },
    ];

    const actionLog: Array<{ tool: string; input: object; output: object }> = [];
    const newCases: VapingCase[] = [];

    let continueLoop = true;
    let finalResponse = "";

    while (continueLoop) {
      const response = await anthropic.messages.create({
        model: "claude-opus-4-5",
        max_tokens: 512,
        system: systemPrompt,
        tools,
        messages,
      });

      if (response.stop_reason === "end_turn") {
        const textBlock = response.content.find((b) => b.type === "text");
        // Strip all markdown before returning so TTS reads cleanly
        finalResponse = textBlock ? stripMarkdown((textBlock as Anthropic.TextBlock).text) : "";
        continueLoop = false;
      } else if (response.stop_reason === "tool_use") {
        messages.push({ role: "assistant", content: response.content });

        const toolResults: Anthropic.ToolResultBlockParam[] = [];

        for (const block of response.content) {
          if (block.type !== "tool_use") continue;
          const toolInput = block.input as Record<string, unknown>;
          const rawOutput = executeTool(block.name, toolInput);
          const parsed = JSON.parse(rawOutput);

          actionLog.push({ tool: block.name, input: toolInput, output: parsed });

          if (block.name === "log_callback_case" && parsed.case) {
            newCases.push(parsed.case);
          }

          toolResults.push({ type: "tool_result", tool_use_id: block.id, content: rawOutput });
        }

        messages.push({ role: "user", content: toolResults });
      } else {
        continueLoop = false;
      }
    }

    // Return updated history including this full exchange
    // Cap at 30 messages but always keep tool_use + tool_result pairs intact
    const updatedHistory = messages.slice(-30);

    return NextResponse.json({ response: finalResponse, actionLog, newCases, updatedHistory });
  } catch (err) {
    console.error("[ARIA Agent Error]", err);
    return NextResponse.json({ error: "Agent encountered an internal error." }, { status: 500 });
  }
}
