// app/api/telegram/notify/route.ts
// Sends a Telegram notification to the vaping officer when a new case is logged

import { NextRequest, NextResponse } from "next/server";

const BOT_TOKEN  = process.env.TELEGRAM_BOT_TOKEN!;
const CHAT_ID    = process.env.TELEGRAM_CHAT_ID!;
const APP_URL    = process.env.NEXT_PUBLIC_APP_URL ?? "https://aria-voice-seven.vercel.app";

export async function POST(req: NextRequest) {
  try {
    const { caseId, name, contact, email, query, callbackTime } = await req.json();

    if (!BOT_TOKEN || !CHAT_ID) {
      return NextResponse.json({ error: "Telegram not configured." }, { status: 500 });
    }

    const message = [
      `🚨 *New Vaping Case Logged via ARIA*`,
      ``,
      `📋 *Case Reference:* \`${caseId}\``,
      `👤 *Caller:* ${name}`,
      `📞 *Contact:* ${contact}`,
      email ? `📧 *Email:* ${email}` : null,
      `📝 *Query:* ${query}`,
      callbackTime ? `🕐 *Preferred Callback:* ${callbackTime}` : null,
      ``,
      `🔗 [View Case on ARIA Portal](${APP_URL})`,
      ``,
      `To close this case, reply:`,
      `\`/close ${caseId} <resolution notes>\``,
      ``,
      `Example:`,
      `\`/close ${caseId} Premises inspected. Fine of SGD 2000 issued. Case resolved.\``,
    ].filter(Boolean).join("\n");

    const res = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: CHAT_ID,
          text: message,
          parse_mode: "Markdown",
          disable_web_page_preview: false,
        }),
      }
    );

    const data = await res.json();
    if (!data.ok) {
      console.error("[Telegram Notify Error]", data);
      return NextResponse.json({ error: data.description }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      messageId: data.result?.message_id,
    });
  } catch (err) {
    console.error("[Telegram Notify Error]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
