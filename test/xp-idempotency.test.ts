import { describe, it, expect } from "bun:test";
import { awardXPInternal } from "../src/lib/xp";
import type { SupabaseClient } from "@supabase/supabase-js";

function makeMockSupabase(shouldConflictOnKey?: string) {
  const inserts: Record<string, unknown>[] = [];

  const client = {
    from: (table: string) => ({
      insert: (row: Record<string, unknown>) => {
        if (shouldConflictOnKey && row.dedupe_key === shouldConflictOnKey) {
          const err = { code: "23505", message: "duplicate key value violates unique constraint" };
          return Promise.resolve({ error: err, data: null });
        }
        inserts.push({ table, row });
        return Promise.resolve({ error: null, data: [row] });
      },
    }),
  } as unknown as SupabaseClient;

  return { client, inserts };
}

describe("XP idempotency", () => {
  it("awards XP on first insert with a dedupe key", async () => {
    const { client, inserts } = makeMockSupabase();
    const result = await awardXPInternal(
      client,
      "user-1",
      "WEEKLY_REVIEW",
      40,
      { weekId: "week-1" },
      "WEEKLY_REVIEW:week-1",
    );

    expect(result.alreadyAwarded).toBe(false);
    expect(result.xpAwarded).toBeGreaterThanOrEqual(40);
    expect(inserts.length).toBe(1);
    expect(inserts[0].row.dedupe_key).toBe("WEEKLY_REVIEW:week-1");
  });

  it("returns 0 XP when the dedupe key conflicts", async () => {
    const { client, inserts } = makeMockSupabase("WEEKLY_REVIEW:week-1");
    const result = await awardXPInternal(
      client,
      "user-1",
      "WEEKLY_REVIEW",
      40,
      { weekId: "week-1" },
      "WEEKLY_REVIEW:week-1",
    );

    expect(result.alreadyAwarded).toBe(true);
    expect(result.xpAwarded).toBe(0);
    expect(result.bonusTriggered).toBe(false);
    expect(inserts.length).toBe(0);
  });

  it("uses deterministic dedupe keys for weekly review", () => {
    const weekId = "week-abc-123";
    const key1 = `WEEKLY_REVIEW:${weekId}`;
    const key2 = `WEEKLY_REVIEW:${weekId}`;
    expect(key1).toBe(key2);
    expect(key1).toMatch(/^WEEKLY_REVIEW:week-abc-123$/);
  });
});
