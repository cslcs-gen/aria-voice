// app/api/agent/route.ts — ARIA Vaping Public Health Assistant Brain

import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import {
  vapingCases,
  generateCaseId,
  VAPING_KNOWLEDGE,
  type VapingCase,
} from "@/lib/vaping-systems";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── Tool Definitions ──────────────────────────────────────────────────────────
const tools: Anthropic.Tool[] = [
  {
    name: "search_vaping_info",
    description:
      "Search the Singapore vaping knowledge base for laws, health effects, penalties, business regulations, and how to report violations. Use this for ANY question about vaping. Always call this before answering vaping-related questions to ensure accuracy.",
    input_schema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "The vaping-related question or topic to look up (e.g. 'penalties for possession', 'health effects', 'how to report')",
        },
        category: {
          type: "string",
          enum: ["laws_penalties", "health_effects", "how_to_report", "business_regulations", "general_faq", "all"],
          description: "Category of information needed",
        },
      },
      required: ["query", "category"],
    },
  },
  {
    name: "log_callback_case",
    description:
      "Log a callback case when the user's query cannot be fully answered or they request to speak with an officer. Collects name, contact, email, nature of query, and preferred callback time. Always confirm the details back to the user before logging.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Full name of the caller" },
        contact: { type: "string", description: "Phone number of the caller" },
        email: { type: "string", description: "Email address (optional)" },
        query: { type: "string", description: "Summary of the query or issue that needs officer follow-up" },
        callbackTime: { type: "string", description: "Preferred callback time (e.g. 'Morning', 'Afternoon', 'Evening', specific time)" },
      },
      required: ["name", "contact", "query"],
    },
  },
  {
    name: "get_case_status",
    description: "Retrieve the status of a previously logged callback case using the case reference number.",
    input_schema: {
      type: "object",
      properties: {
        case_id: { type: "string", description: "The case reference number (e.g. VPG-20240115-AB12)" },
      },
      required: ["case_id"],
    },
  },
  {
    name: "list_all_cases",
    description: "List all logged callback cases in the system. Use when user asks to see all cases or track their submissions.",
    input_schema: {
      type: "object",
      properties: {
        status_filter: {
          type: "string",
          enum: ["all", "open", "in_progress", "resolved"],
          description: "Filter cases by status",
        },
      },
      required: ["status_filter"],
    },
  },
];

// ── Tool Implementations ──────────────────────────────────────────────────────
function search_vaping_info(query: string, category: string): object {
  // Return relevant sections based on category
  const kb = VAPING_KNOWLEDGE;
  let relevantSections = "";

  if (category === "all" || category === "laws_penalties") {
    const match = kb.match(/## Singapore Vaping Laws[\s\S]*?(?=##|$)/);
    if (match) relevantSections += match[0];
  }
  if (category === "all" || category === "health_effects") {
    const match = kb.match(/## Health Effects[\s\S]*?(?=##|$)/);
    if (match) relevantSections += match[0];
  }
  if (category === "all" || category === "how_to_report") {
    const match = kb.match(/## How to Report[\s\S]*?(?=##|$)/);
    if (match) relevantSections += match[0];
  }
  if (category === "all" || category === "business_regulations") {
    const match = kb.match(/## Vaping Regulations for Businesses[\s\S]*?(?=##|$)/);
    if (match) relevantSections += match[0];
  }
  if (category === "all" || category === "general_faq") {
    const match = kb.match(/## Frequently Asked Questions[\s\S]*?(?=##|$)/);
    if (match) relevantSections += match[0];
  }

  if (!relevantSections) relevantSections = kb;

  return {
    success: true,
    query,
    category,
    information: relevantSections.trim(),
    source: "Singapore Health Sciences Authority (HSA) & National Environment Agency (NEA) — Official Guidelines 2024",
    disclaimer: "This information is based on Singapore regulations as of 2024. For the most current information, always verify with HSA at hsa.gov.sg or call 1800-117-8333.",
  };
}

function log_callback_case(
  name: string,
  contact: string,
  query: string,
  email?: string,
  callbackTime?: string
): object {
  const newCase: VapingCase = {
    id: generateCaseId(),
    name,
    contact,
    email,
    query,
    callbackTime: callbackTime ?? "Any time",
    status: "open",
    createdAt: new Date().toISOString(),
    notes: "Case logged via ARIA voice assistant. Awaiting officer assignment.",
  };
  vapingCases.push(newCase);

  return {
    success: true,
    case: newCase,
    message: `Case successfully logged. Reference number: ${newCase.id}. An officer will call ${name} at ${contact} ${callbackTime ? `during ${callbackTime}` : "at the earliest opportunity"}.`,
    nextSteps: "Please save your reference number. You can track your case status by quoting this number.",
  };
}

function get_case_status(case_id: string): object {
  const found = vapingCases.find(
    (c) => c.id.toLowerCase() === case_id.toLowerCase()
  );
  if (!found) {
    return {
      success: false,
      error: `No case found with reference number ${case_id}. Please check the number and try again.`,
    };
  }
  return {
    success: true,
    case: found,
    message: `Case ${found.id} for ${found.name} is currently ${found.status.replace("_", " ")}. Query: ${found.query}`,
  };
}

function list_all_cases(status_filter: string): object {
  const filtered =
    status_filter === "all"
      ? vapingCases
      : vapingCases.filter((c) => c.status === status_filter);

  return {
    success: true,
    total: filtered.length,
    cases: filtered.map((c) => ({
      id: c.id,
      name: c.name,
      contact: c.contact,
      query: c.query,
      status: c.status,
      createdAt: c.createdAt,
      callbackTime: c.callbackTime,
    })),
    message: filtered.length === 0
      ? "No cases found."
      : `Found ${filtered.length} case(s).`,
  };
}

// ── Tool Dispatcher ───────────────────────────────────────────────────────────
function executeTool(name: string, input: Record<string, unknown>): string {
  let result: object;
  switch (name) {
    case "search_vaping_info":
      result = search_vaping_info(input.query as string, input.category as string);
      break;
    case "log_callback_case":
      result = log_callback_case(
        input.name as string,
        input.contact as string,
        input.query as string,
        input.email as string | undefined,
        input.callbackTime as string | undefined
      );
      break;
    case "get_case_status":
      result = get_case_status(input.case_id as string);
      break;
    case "list_all_cases":
      result = list_all_cases(input.status_filter as string);
      break;
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

    const systemPrompt = `You are ARIA — Adaptive Resolution & Intelligence Agent — a friendly, professional public health voice assistant for Singapore's vaping enforcement and education helpline.

YOUR PURPOSE:
- Answer questions about Singapore vaping laws, penalties, health effects, business regulations, and how to report violations.
- Use the search_vaping_info tool to retrieve accurate, up-to-date information before answering.
- If a query cannot be fully answered or the caller wants to speak to an officer, collect their details and log a callback case.
- Speak naturally as if on a phone call — be warm, concise, and helpful.

CONVERSATION RULES:
1. Always search for information before answering vaping questions — never answer from memory alone.
2. Keep responses concise and spoken-friendly — no bullet points or markdown in your voice response.
3. This is a multi-turn conversation. Never re-greet or re-introduce yourself after the first message.
4. If the caller's question cannot be answered confidently, offer to log a callback case for an officer.
5. When logging a case, collect: full name, contact number, and optionally email, nature of query, preferred callback time.
6. Always confirm case details back to the caller before logging.
7. After logging a case, give the caller their reference number clearly.
8. Vary your language — never repeat the same phrasing twice in a conversation.
9. Always end responses with a helpful offer like "Is there anything else I can help you with?"

CASE LOGGING FLOW:
- If user needs callback: ask for name first, then contact number, then email (optional), then preferred callback time.
- Confirm all details before calling log_callback_case.
- After logging, clearly state the reference number and what happens next.

IMPORTANT:
- You represent Singapore's public health authority. Be authoritative but approachable.
- Always recommend callers verify latest regulations at hsa.gov.sg or call HSA at 1800-117-8333.
- Never give legal advice — refer serious legal matters to qualified lawyers or HSA officers.`;

    const messages: Anthropic.MessageParam[] = [
      ...(conversationHistory as Anthropic.MessageParam[]).slice(-20),
      { role: "user", content: transcript },
    ];

    const actionLog: Array<{ tool: string; input: object; output: object }> = [];
    const newCases: VapingCase[] = [];

    let continueLoop = true;
    let finalResponse = "";

    while (continueLoop) {
      const response = await anthropic.messages.create({
        model: "claude-opus-4-5",
        max_tokens: 1024,
        system: systemPrompt,
        tools,
        messages,
      });

      if (response.stop_reason === "end_turn") {
        const textBlock = response.content.find((b) => b.type === "text");
        finalResponse = textBlock ? (textBlock as Anthropic.TextBlock).text : "";
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

          // Capture new cases
          if (block.name === "log_callback_case" && parsed.case) {
            newCases.push(parsed.case);
          }

          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: rawOutput,
          });
        }

        messages.push({ role: "user", content: toolResults });
      } else {
        continueLoop = false;
      }
    }

    const updatedHistory = messages.slice(-20);

    return NextResponse.json({
      response: finalResponse,
      actionLog,
      newCases,
      updatedHistory,
    });
  } catch (err) {
    console.error("[ARIA Agent Error]", err);
    return NextResponse.json({ error: "Agent encountered an internal error." }, { status: 500 });
  }
}
