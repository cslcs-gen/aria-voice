// lib/redis.ts — Upstash Redis client singleton
import { Redis } from "@upstash/redis";

export const redis = new Redis({
  url:   process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// ── Case helpers ──────────────────────────────────────────────────────────────
export interface StoredCase {
  id: string;
  name: string;
  contact: string;
  email?: string;
  query: string;
  callbackTime?: string;
  status: "open" | "in_progress" | "resolved";
  createdAt: string;
  resolvedAt?: string;
  notes?: string;
}

const CASES_KEY = "aria:cases";

export async function saveCase(c: StoredCase): Promise<void> {
  // Store each case by ID and add to the index list
  await redis.set(`aria:case:${c.id}`, JSON.stringify(c));
  await redis.lpush(CASES_KEY, c.id);
}

export async function updateCase(id: string, updates: Partial<StoredCase>): Promise<StoredCase | null> {
  const raw = await redis.get<string>(`aria:case:${id}`);
  if (!raw) return null;
  const existing: StoredCase = typeof raw === "string" ? JSON.parse(raw) : raw;
  const updated = { ...existing, ...updates };
  await redis.set(`aria:case:${id}`, JSON.stringify(updated));
  return updated;
}

export async function getCase(id: string): Promise<StoredCase | null> {
  const raw = await redis.get<string>(`aria:case:${id}`);
  if (!raw) return null;
  return typeof raw === "string" ? JSON.parse(raw) : raw;
}

export async function getAllCases(): Promise<StoredCase[]> {
  const ids = await redis.lrange(CASES_KEY, 0, -1);
  if (!ids || ids.length === 0) return [];
  const cases = await Promise.all(
    ids.map(async (id) => {
      const raw = await redis.get<string>(`aria:case:${id}`);
      if (!raw) return null;
      return typeof raw === "string" ? JSON.parse(raw) : raw;
    })
  );
  return cases.filter(Boolean) as StoredCase[];
}
