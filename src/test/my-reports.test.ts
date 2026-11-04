import { describe, expect, it } from "vitest";
import { latestDecisionNote } from "@/lib/tasks";

const A = "11111111-1111-1111-1111-111111111111";
const B = "22222222-2222-2222-2222-222222222222";

describe("latestDecisionNote", () => {
  it("returns the newest note left while the call moved status", () => {
    expect(latestDecisionNote([
      { task_id: A, body: "אושר בתקציב 500 ש\"ח", created_at: "2026-02-01T09:00:00Z" },
      { task_id: A, body: "הונחה הוראה: לבצע ביום ראשון", created_at: "2026-02-03T09:00:00Z" },
      { task_id: A, body: "נדחה", created_at: "2026-02-02T09:00:00Z" },
    ], A)).toBe("הונחה הוראה: לבצע ביום ראשון");
  });

  it("ignores notes left on other calls", () => {
    expect(latestDecisionNote([{ task_id: B, body: "שייך לקריאה אחרת", created_at: "2026-02-03T09:00:00Z" }], A)).toBeNull();
  });

  it("is null when no note was ever given", () => {
    expect(latestDecisionNote([], A)).toBeNull();
  });
});import { latestDecisionNote as pickLatest } from '@/lib/tasks';
import { describe as d2, it as i2, expect as e2 } from 'vitest';
d2('reporter latest update', () => {
  i2('picks the newest among public notes and decisions', () => {
    const rows = [
      { task_id: 't', body: 'decision', created_at: '2026-01-01T10:00:00Z' },
      { task_id: 't', body: 'public note', created_at: '2026-01-02T10:00:00Z' },
    ];
    e2(pickLatest(rows, 't')).toBe('public note');
  });
});
