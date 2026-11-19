import { assert, assertEquals, assertThrows } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { buildSystemPrompt, buildUserPrompt, sanitizeStats } from "./prompt.ts";

const goodStats = {
  score: 80,
  workoutsPlanned: 4,
  workoutsCompleted: 3,
  workoutsSkipped: 1,
  workoutsExcused: 0,
  plannedMinutes: 200,
  completedMinutes: 160,
};

Deno.test("sanitizeStats drops fields outside the allow-list", () => {
  const out = sanitizeStats({ ...goodStats, stravaActivityId: 123, polyline: "abc", activities: [{ id: 1 }] });
  assertEquals(Object.keys(out).sort(), [
    "avgRpe", "completedMinutes", "plannedMinutes", "score",
    "workoutsCompleted", "workoutsExcused", "workoutsPlanned", "workoutsSkipped",
  ]);
  assert(!JSON.stringify(out).includes("polyline"));
});

Deno.test("sanitizeStats rejects malformed values", () => {
  assertThrows(() => sanitizeStats({ ...goodStats, score: 150 }));
  assertThrows(() => sanitizeStats({ ...goodStats, plannedMinutes: "200" }));
  assertThrows(() => sanitizeStats(null));
});

Deno.test("re-engager prompt forbids jargon and shaming", () => {
  const p = buildSystemPrompt({ fitnessMode: "re_engager", coachingStyle: "supportive" });
  assert(p.includes("NEVER mention TSS"));
  assert(p.includes("NEVER shame"));
});

Deno.test("performance prompt may reference load", () => {
  const p = buildSystemPrompt({ fitnessMode: "performance", coachingStyle: "analytical" });
  assert(!p.includes("NEVER mention TSS"));
  assert(p.includes("training load"));
});

Deno.test("zero-completed week never exposes a score to the model", () => {
  const u = buildUserPrompt(sanitizeStats({ ...goodStats, score: 0, workoutsCompleted: 0, completedMinutes: 0 }));
  assert(u.includes("Nothing was completed"));
  assert(!u.includes("Adherence score"));
});
