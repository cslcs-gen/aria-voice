// app/api/agent/route.ts — The Agentic Brain

import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import {
  employees,
  vpnStatus,
  softwareInventory,
  tickets,
  generateTicketId,
  type Employee,
} from "@/lib/it-systems";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── Tool Definitions ──────────────────────────────────────────────────────────
const tools: Anthropic.Tool[] = [
  {
    name: "verify_user",
    description:
      "Verify an employee's identity by their Employee ID or name. Returns account status and basic profile. Always call this first before taking any action on an account.",
    input_schema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Employee ID (e.g. EMP001) or full name to look up",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "unlock_account",
    description:
      "Unlock a locked LDAP/email account for a verified employee and issue a temporary password. Only call after verify_user confirms the account is locked.",
    input_schema: {
      type: "object",
      properties: {
        employee_id: { type: "string", description: "The employee's ID (e.g. EMP001)" },
      },
      required: ["employee_id"],
    },
  },
  {
    name: "fix_vpn_connection",
    description:
      "Check VPN status for an employee, identify certificate issues, and push a certificate refresh if needed.",
    input_schema: {
      type: "object",
      properties: {
        employee_id: { type: "string", description: "The employee's ID (e.g. EMP001)" },
      },
      required: ["employee_id"],
    },
  },
  {
    name: "request_software",
    description:
      "Check software license availability and assign a license to an employee if one is available.",
    input_schema: {
      type: "object",
      properties: {
        employee_id: { type: "string", description: "The employee's ID" },
        software_name: {
          type: "string",
          description: "Name of the software (e.g. Figma, Adobe Creative Cloud, Slack, GitHub Copilot)",
        },
      },
      required: ["employee_id", "software_name"],
    },
  },
  {
    name: "log_to_crm",
    description:
      "Log a resolved or in-progress IT ticket to the CRM system. Call this after completing any action.",
    input_schema: {
      type: "object",
      properties: {
        employee_id: { type: "string" },
        ticket_type: {
          type: "string",
          enum: ["account_lockout", "vpn_issue", "software_request", "general"],
        },
        summary: { type: "string", description: "Brief summary of what was done" },
        status: { type: "string", enum: ["open", "in_progress", "resolved"] },
        actions_taken: {
          type: "array",
          items: { type: "string" },
          description: "List of actions performed",
        },
      },
      required: ["employee_id", "ticket_type", "summary", "status", "actions_taken"],
    },
  },
];

// ── Tool Implementations ──────────────────────────────────────────────────────
function verify_user(query: string): object {
  const q = query.toLowerCase().trim();
  const emp =
    employees.find((e) => e.id.toLowerCase() === q) ||
    employees.find((e) => e.name.toLowerCase().includes(q));

  if (!emp) {
    return { success: false, error: `No employee found matching "${query}". Please check the ID or name.` };
  }
  emp.verified = true;
  return {
    success: true,
    employee: {
      id: emp.id,
      name: emp.name,
      email: emp.email,
      department: emp.department,
      accountStatus: emp.accountStatus,
      lastLogin: emp.lastLogin,
    },
  };
}

function unlock_account(employee_id: string): object {
  const emp = employees.find((e) => e.id === employee_id);
  if (!emp) return { success: false, error: "Employee not found." };
  if (!emp.verified) return { success: false, error: "Employee must be verified first." };
  if (emp.accountStatus !== "locked")
    return { success: false, message: `Account is already ${emp.accountStatus}. No action needed.` };

  emp.accountStatus = "active";
  const tempPassword = `TempP@ss${Math.random().toString(36).slice(-6).toUpperCase()}!`;
  return {
    success: true,
    message: `Account for ${emp.name} has been unlocked in LDAP and Active Directory.`,
    tempPassword,
    emailSent: true,
    instructions: `Temporary password sent to ${emp.email}. User must change on next login.`,
  };
}

function fix_vpn_connection(employee_id: string): object {
  const emp = employees.find((e) => e.id === employee_id);
  if (!emp) return { success: false, error: "Employee not found." };

  const vpn = vpnStatus.find((v) => v.employeeId === employee_id);
  if (!vpn) return { success: false, error: "No VPN record found for this employee." };

  if (vpn.connected) {
    return { success: true, message: `${emp.name}'s VPN is already connected and healthy.`, action: "none" };
  }

  const actions: string[] = [];
  if (vpn.certificateStatus === "expired" || vpn.certificateStatus === "expiring_soon") {
    vpn.certificateExpiry = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
    vpn.certificateStatus = "valid";
    actions.push(`Certificate renewed — new expiry: ${vpn.certificateExpiry.split("T")[0]}`);
  }
  vpn.connected = true;
  vpn.lastAttempt = new Date().toISOString();
  delete vpn.errorCode;
  actions.push("VPN tunnel re-established successfully");

  return {
    success: true,
    previousStatus: "Disconnected — certificate expired",
    actions,
    currentStatus: "Connected",
    message: `VPN issue resolved for ${emp.name}. Certificate refreshed and connection restored.`,
  };
}

function request_software(employee_id: string, software_name: string): object {
  const emp = employees.find((e) => e.id === employee_id);
  if (!emp) return { success: false, error: "Employee not found." };

  const inv = softwareInventory.find((s) =>
    s.software.toLowerCase().includes(software_name.toLowerCase())
  );
  if (!inv) {
    const available = softwareInventory.map((s) => s.software).join(", ");
    return { success: false, error: `Software "${software_name}" not found. Available: ${available}` };
  }

  if (inv.assignedTo.includes(employee_id)) {
    return {
      success: false,
      message: `${emp.name} already has a ${inv.software} license assigned.`,
    };
  }

  const available = inv.totalLicenses - inv.usedLicenses;
  if (available <= 0) {
    return {
      success: false,
      error: `No ${inv.software} licenses available. All ${inv.totalLicenses} are in use. Please contact procurement.`,
    };
  }

  inv.assignedTo.push(employee_id);
  inv.usedLicenses += 1;

  return {
    success: true,
    software: inv.software,
    assignedTo: emp.name,
    licensesRemaining: inv.totalLicenses - inv.usedLicenses,
    message: `${inv.software} license assigned to ${emp.name}. ${inv.totalLicenses - inv.usedLicenses} licenses remain.`,
    activationEmail: `Activation link sent to ${emp.email}.`,
  };
}

function log_to_crm(
  employee_id: string,
  ticket_type: "account_lockout" | "vpn_issue" | "software_request" | "general",
  summary: string,
  status: "open" | "in_progress" | "resolved",
  actions_taken: string[]
): object {
  const emp = employees.find((e) => e.id === employee_id);
  const ticket = {
    id: generateTicketId(),
    employeeId: employee_id,
    employeeName: emp?.name ?? "Unknown",
    type: ticket_type,
    summary,
    status,
    createdAt: new Date().toISOString(),
    resolvedAt: status === "resolved" ? new Date().toISOString() : undefined,
    actions: actions_taken,
  };
  tickets.push(ticket);
  return { success: true, ticket };
}

// ── Tool Dispatcher ───────────────────────────────────────────────────────────
function executeTool(name: string, input: Record<string, unknown>): string {
  let result: object;
  switch (name) {
    case "verify_user":
      result = verify_user(input.query as string);
      break;
    case "unlock_account":
      result = unlock_account(input.employee_id as string);
      break;
    case "fix_vpn_connection":
      result = fix_vpn_connection(input.employee_id as string);
      break;
    case "request_software":
      result = request_software(input.employee_id as string, input.software_name as string);
      break;
    case "log_to_crm":
      result = log_to_crm(
        input.employee_id as string,
        input.ticket_type as "account_lockout" | "vpn_issue" | "software_request" | "general",
        input.summary as string,
        input.status as "open" | "in_progress" | "resolved",
        input.actions_taken as string[]
      );
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

    const systemPrompt = `You are ARIA — Autonomous Resolution & IT Agent — an expert IT support AI.
Your job is to resolve employee IT issues quickly and precisely by calling the right tools in sequence.

RULES:
1. Always verify the user's identity first with verify_user before taking any account action.
2. Think step-by-step. Use tools in logical order.
3. After resolving any issue, always call log_to_crm to record it.
4. Be concise and professional in your spoken responses. You are talking to an employee on the phone.
5. If you cannot resolve something, explain why clearly.
6. Never expose raw passwords in your spoken response — just confirm they were sent by email.

Available employees: EMP001 (Sarah Chen), EMP002 (Marcus Webb), EMP003 (Priya Nair), EMP004 (Jordan Blake), EMP005 (Alex Rivera).`;

    const messages: Anthropic.MessageParam[] = [
      ...conversationHistory,
      { role: "user", content: transcript },
    ];

    const actionLog: Array<{ tool: string; input: object; output: object }> = [];
    const newTickets: object[] = [];

    // Agentic loop
    let continueLoop = true;
    let finalResponse = "";

    while (continueLoop) {
      const response = await anthropic.messages.create({
        model: "claude-opus-4-5",
        max_tokens: 2048,
        system: systemPrompt,
        tools,
        messages,
      });

      if (response.stop_reason === "end_turn") {
        const textBlock = response.content.find((b) => b.type === "text");
        finalResponse = textBlock ? (textBlock as Anthropic.TextBlock).text : "";
        continueLoop = false;
      } else if (response.stop_reason === "tool_use") {
        // Add assistant's tool_use blocks to message history
        messages.push({ role: "assistant", content: response.content });

        // Execute each tool and collect results
        const toolResults: Anthropic.ToolResultBlockParam[] = [];

        for (const block of response.content) {
          if (block.type !== "tool_use") continue;
          const toolInput = block.input as Record<string, unknown>;
          const rawOutput = executeTool(block.name, toolInput);
          const parsed = JSON.parse(rawOutput);

          actionLog.push({ tool: block.name, input: toolInput, output: parsed });

          // Capture new tickets
          if (block.name === "log_to_crm" && parsed.ticket) {
            newTickets.push(parsed.ticket);
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

    // Build updated conversation history (cap at last 20 messages)
    const updatedHistory = messages.slice(-20);

    return NextResponse.json({
      response: finalResponse,
      actionLog,
      newTickets,
      updatedHistory,
    });
  } catch (err) {
    console.error("[Agent Error]", err);
    return NextResponse.json({ error: "Agent encountered an internal error." }, { status: 500 });
  }
}
