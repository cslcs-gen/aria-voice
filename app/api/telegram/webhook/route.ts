// app/api/telegram/webhook/route.ts
// Receives officer replies from Telegram and updates case status
// Set this as your bot's webhook URL in Telegram

import { NextRequest, NextResponse } from "next/server";
import { vapingCases } from "@/lib/vaping-systems";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
const CHAT_ID   = process.env.TELEGRAM_CHAT_ID!;

async function sendTelegram(text: string) {
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: CHAT_ID,
      text,
      parse_mode: "Markdown",
    }),
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const message = body?.message;
    if (!message?.text) return NextResponse.json({ ok: true });

    const text: string = message.text.trim();
    const fromId = String(message.chat?.id ?? "");

    // Only process messages from the authorised officer chat
    if (fromId !== String(CHAT_ID)) {
      return NextResponse.json({ ok: true });
    }

    // Parse /close command: /close VPG-XXXXXXXX-XXXX <resolution notes>
    if (text.startsWith("/close ")) {
      const parts = text.slice(7).trim().split(" ");
      const caseRef = parts[0]?.toUpperCase();
      const notes   = parts.slice(1).join(" ").trim();

      if (!caseRef) {
        await sendTelegram("❌ Invalid format. Use:\n`/close VPG-XXXXXXXX-XXXX Resolution notes here`");
        return NextResponse.json({ ok: true });
      }

      // Find and update the case
      const found = vapingCases.find(
        c => c.id.toUpperCase() === caseRef || c.id.toUpperCase().includes(caseRef)
      );

      if (!found) {
        await sendTelegram(`❌ Case \`${caseRef}\` not found. Please check the reference number.`);
        return NextResponse.json({ ok: true });
      }

      if (found.status === "resolved") {
        await sendTelegram(`ℹ️ Case \`${found.id}\` is already resolved.`);
        return NextResponse.json({ ok: true });
      }

      // Update case
      found.status    = "resolved";
      found.resolvedAt = new Date().toISOString();
      found.notes     = notes || "Case resolved by officer via Telegram.";

      // Confirm closure back to officer
      const resolvedAt = new Date().toLocaleString("en-SG", { timeZone: "Asia/Singapore" });
      await sendTelegram(
        `✅ *Case Closed Successfully*\n\n` +
        `📋 *Reference:* \`${found.id}\`\n` +
        `👤 *Caller:* ${found.name}\n` +
        `📞 *Contact:* ${found.contact}\n` +
        `📝 *Resolution:* ${found.notes}\n` +
        `🕐 *Closed at:* ${resolvedAt} SGT\n\n` +
        `The ARIA portal has been updated automatically.`
      );

      return NextResponse.json({ ok: true, updated: found });
    }

    // /status command — check a case
    if (text.startsWith("/status ")) {
      const caseRef = text.slice(8).trim().toUpperCase();
      const found = vapingCases.find(c => c.id.toUpperCase() === caseRef);

      if (!found) {
        await sendTelegram(`❌ Case \`${caseRef}\` not found.`);
      } else {
        await sendTelegram(
          `📋 *Case Status*\n\n` +
          `*Reference:* \`${found.id}\`\n` +
          `*Caller:* ${found.name} | ${found.contact}\n` +
          `*Query:* ${found.query}\n` +
          `*Status:* ${found.status.replace("_", " ").toUpperCase()}\n` +
          `*Logged:* ${new Date(found.createdAt).toLocaleString("en-SG", { timeZone: "Asia/Singapore" })} SGT` +
          (found.resolvedAt ? `\n*Resolved:* ${new Date(found.resolvedAt).toLocaleString("en-SG", { timeZone: "Asia/Singapore" })} SGT` : "")
        );
      }
      return NextResponse.json({ ok: true });
    }

    // /list command — list all open cases
    if (text === "/list" || text === "/cases") {
      const open = vapingCases.filter(c => c.status !== "resolved");
      if (open.length === 0) {
        await sendTelegram("✅ No open cases at this time.");
      } else {
        const lines = open.map(c =>
          `• \`${c.id}\` — ${c.name} | ${c.status.replace("_"," ")}`
        ).join("\n");
        await sendTelegram(`📋 *Open Cases (${open.length})*\n\n${lines}`);
      }
      return NextResponse.json({ ok: true });
    }

    // /help command
    if (text === "/help" || text === "/start") {
      await sendTelegram(
        `🤖 *ARIA Officer Bot Commands*\n\n` +
        `/close <case_ref> <notes> — Close and resolve a case\n` +
        `/status <case_ref> — Check case status\n` +
        `/list — List all open cases\n` +
        `/help — Show this help message\n\n` +
        `*Example:*\n` +
        `\`/close VPG-20240115-AB12 Fine of SGD 2000 issued. Premises warned.\``
      );
      return NextResponse.json({ ok: true });
    }

    // Unknown command
    await sendTelegram(
      `❓ Unknown command. Send /help to see available commands.`
    );
    return NextResponse.json({ ok: true });

  } catch (err) {
    console.error("[Telegram Webhook Error]", err);
    return NextResponse.json({ ok: true }); // Always return 200 to Telegram
  }
}

// GET — for verifying webhook is alive
export async function GET() {
  return NextResponse.json({ ok: true, service: "ARIA Telegram Webhook", status: "active" });
}
