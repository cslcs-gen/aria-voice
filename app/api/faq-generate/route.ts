// app/api/faq-generate/route.ts
// Simulates ARIA reading the Tobacco Act and auto-generating FAQs via Claude

import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { faqStore, TOBACCO_ACT_TEXT, type GeneratedFAQ } from "@/lib/vaping-systems";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST() {
  try {
    const startTime = Date.now();

    const prompt = `You are a legal information assistant. You have been provided the full text of Singapore's Tobacco (Control of Advertisements and Sale) Act.

Your task is to read this Act carefully and generate exactly 12 clear, plain-English FAQs that members of the public and potential offenders would want to know. Cover these categories: laws_penalties, health_education, reporting, business_compliance, offender_rights, minors_protection.

Generate 2 FAQs per category. Each FAQ must be directly grounded in the Act text provided.

Return ONLY a valid JSON array with this exact structure, no other text:
[
  {
    "id": "faq_001",
    "category": "laws_penalties",
    "question": "question text here",
    "answer": "answer text here — 2 to 4 sentences, plain English, no markdown",
    "relevantSection": "Section 16A" 
  }
]

Categories to use: laws_penalties, health_education, reporting, business_compliance, offender_rights, minors_protection

THE ACT TEXT:
${TOBACCO_ACT_TEXT}`;

    const response = await anthropic.messages.create({
      model: "claude-opus-4-5",
      max_tokens: 3000,
      messages: [{ role: "user", content: prompt }],
    });

    const raw = response.content.find(b => b.type === "text") as Anthropic.TextBlock | undefined;
    if (!raw) throw new Error("No response from Claude");

    // Parse JSON — strip any markdown fences if present
    let jsonText = raw.text.trim();
    jsonText = jsonText.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();

    const faqs: GeneratedFAQ[] = JSON.parse(jsonText);

    // Update the shared FAQ store
    faqStore.faqs = faqs;
    faqStore.lastUpdated = new Date().toISOString();
    faqStore.actVersion = "Tobacco (Control of Advertisements and Sale) Act (Cap 309) — Rev. Ed. 2011, amended Feb 2023";
    faqStore.actSource = "https://sso.agc.gov.sg/Act/TCASA1993";
    faqStore.generatedBy = `ARIA AI — Claude claude-opus-4-5 — Generated in ${((Date.now() - startTime) / 1000).toFixed(1)}s`;
    faqStore.totalGenerated = faqs.length;

    return NextResponse.json({
      success: true,
      faqs,
      lastUpdated: faqStore.lastUpdated,
      actVersion: faqStore.actVersion,
      generatedBy: faqStore.generatedBy,
      totalGenerated: faqs.length,
    });
  } catch (err) {
    console.error("[FAQ Generate Error]", err);
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}

export async function GET() {
  // Return current FAQ store state
  return NextResponse.json({
    success: true,
    faqs: faqStore.faqs,
    lastUpdated: faqStore.lastUpdated,
    actVersion: faqStore.actVersion,
    actSource: faqStore.actSource,
    generatedBy: faqStore.generatedBy,
    totalGenerated: faqStore.totalGenerated,
  });
}
