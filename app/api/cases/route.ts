// app/api/cases/route.ts
// Returns all callback cases — used by frontend to poll for Telegram-resolved cases

import { NextResponse } from "next/server";
import { vapingCases } from "@/lib/vaping-systems";

export async function GET() {
  return NextResponse.json({
    success: true,
    cases: vapingCases,
    total: vapingCases.length,
    open: vapingCases.filter(c => c.status !== "resolved").length,
    resolved: vapingCases.filter(c => c.status === "resolved").length,
  });
}
