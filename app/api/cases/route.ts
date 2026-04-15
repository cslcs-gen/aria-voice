// app/api/cases/route.ts
import { NextResponse } from "next/server";
import { getAllCases } from "@/lib/redis";

export async function GET() {
  try {
    const cases = await getAllCases();
    return NextResponse.json({
      success: true,
      cases,
      total:    cases.length,
      open:     cases.filter(c => c.status !== "resolved").length,
      resolved: cases.filter(c => c.status === "resolved").length,
    });
  } catch (err) {
    console.error("[Cases API Error]", err);
    return NextResponse.json({ success: false, cases: [], total: 0, open: 0, resolved: 0 });
  }
}
