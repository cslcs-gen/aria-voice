// app/api/telegram/webhook/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getAllCases, updateCase, getCase } from "@/lib/redis";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
const CHAT_ID   = process.env.TELEGRAM_CHAT_ID!;

async function sendTelegram(text: string) {
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: CHAT_ID, text, parse_mode: "Markdown" }),
  });
}

export async function POST(req: NextRequest) {
  try {
    const body   = await req.json();
    const message = body?.message;
    if (!message?.text) return NextResponse.json({ ok: true });

    const text: string = message.text.trim();
    const fromId = String(message.chat?.id ?? "");

    // Only process from authorised chat
    if (fromId !== String(CHAT_ID)) return NextResponse.json({ ok: true });

    // /close <case_ref> <notes>
    if (text.startsWith("/close ")) {
      const parts   = text.slice(7).trim().split(" ");
      const caseRef = parts[0]?.toUpperCase();
      const notes   = parts.slice(1).join(" ").trim();

      if (!caseRef) {
        await sendTelegram("❌ Format: `/close VPG-XXXXXXXX-XXXX Resolution notes`");
        return NextResponse.json({ ok: true });
      }

      // Look up case from Redis
      const found = await getCase(caseRef);

      // If not found by exact ID, try searching all cases
      if (!found) {
        const all = await getAllCases();
        const match = all.find(c =>
          c.id.toUpperCase() === caseRef ||
          c.id.toUpperCase().includes(caseRef)
        );
        if (!match) {
          await sendTelegram(`❌ Case \`${caseRef}\` not found. Use /list to see all open cases.`);
          return NextResponse.json({ ok: true });
        }
        // Use match
        if (match.status === "resolved") {
          await sendTelegram(`ℹ️ Case \`${match.id}\` is already resolved.`);
          return NextResponse.json({ ok: true });
        }
        const updated = await updateCase(match.id, {
          status: "resolved",
          resolvedAt: new Date().toISOString(),
          notes: notes || "Case resolved by officer via Telegram.",
        });
        if (!updated) {
          await sendTelegram(`❌ Failed to update case \`${match.id}\`. Please try again.`);
          return NextResponse.json({ ok: true });
        }
        const resolvedAt = new Date().toLocaleString("en-SG", { timeZone: "Asia/Singapore" });
        await sendTelegram(
          `✅ *Case Closed*\n\n` +
          `📋 *Reference:* \`${updated.id}\`\n` +
          `👤 *Caller:* ${updated.name}\n` +
          `📞 *Contact:* ${updated.contact}\n` +
          `📝 *Resolution:* ${updated.notes}\n` +
          `🕐 *Closed:* ${resolvedAt} SGT\n\n` +
          `ARIA portal updated automatically. ✅`
        );
        return NextResponse.json({ ok: true });
      }

      if (found.status === "resolved") {
        await sendTelegram(`ℹ️ Case \`${found.id}\` is already resolved.`);
        return NextResponse.json({ ok: true });
      }

      const updated = await updateCase(found.id, {
        status: "resolved",
        resolvedAt: new Date().toISOString(),
        notes: notes || "Case resolved by officer via Telegram.",
      });

      if (!updated) {
        await sendTelegram(`❌ Failed to update case. Please try again.`);
        return NextResponse.json({ ok: true });
      }

      const resolvedAt = new Date().toLocaleString("en-SG", { timeZone: "Asia/Singapore" });
      await sendTelegram(
        `✅ *Case Closed Successfully*\n\n` +
        `📋 *Reference:* \`${updated.id}\`\n` +
        `👤 *Caller:* ${updated.name}\n` +
        `📞 *Contact:* ${updated.contact}\n` +
        `📝 *Resolution:* ${updated.notes}\n` +
        `🕐 *Closed at:* ${resolvedAt} SGT\n\n` +
        `The ARIA portal has been updated automatically. ✅`
      );
      return NextResponse.json({ ok: true });
    }

    // /status <case_ref>
    if (text.startsWith("/status ")) {
      const caseRef = text.slice(8).trim().toUpperCase();
      const found   = await getCase(caseRef);
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

    // /list — all open cases
    if (text === "/list" || text === "/cases") {
      const all  = await getAllCases();
      const open = all.filter(c => c.status !== "resolved");
      if (open.length === 0) {
        await sendTelegram("✅ No open cases at this time.");
      } else {
        const lines = open.map(c =>
          `• \`${c.id}\` — ${c.name} (${c.status.replace("_"," ")})`
        ).join("\n");
        await sendTelegram(`📋 *Open Cases (${open.length})*\n\n${lines}`);
      }
      return NextResponse.json({ ok: true });
    }

    // /help or /start
    if (text === "/help" || text === "/start") {
      await sendTelegram(
        `🤖 *ARIA Officer Bot*\n\n` +
        `/close <ref> <notes> — Resolve a case\n` +
        `/status <ref> — Check case status\n` +
        `/list — List all open cases\n` +
        `/help — Show this message\n\n` +
        `*Example:*\n` +
        `\`/close VPG-20240115-AB12 Fine SGD 2000 issued.\``
      );
      return NextResponse.json({ ok: true });
    }

    await sendTelegram("❓ Unknown command. Send /help for available commands.");
    return NextResponse.json({ ok: true });

  } catch (err) {
    console.error("[Telegram Webhook Error]", err);
    return NextResponse.json({ ok: true });
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, service: "ARIA Telegram Webhook", status: "active" });
}
