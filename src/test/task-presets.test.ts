import { describe, expect, it } from "vitest";
import { applyPreset } from "@/lib/tasks";

describe("Personal action list and counter", () => {
  it("includes only non-archived, unfinished tasks assigned to the current user", () => {
    const calls: unknown[][] = [];
    const q = {
      eq: (...args: unknown[]) => { calls.push(["eq", ...args]); return q; },
      not: (...args: unknown[]) => { calls.push(["not", ...args]); return q; },
      lt: (...args: unknown[]) => { calls.push(["lt", ...args]); return q; },
    };
    applyPreset(q, "my_action", "current-user");
    expect(calls).toEqual([["eq", "archived", false], ["not", "status", "in", "(closed,cancelled)"], ["eq", "assignee_id", "current-user"]]);
  });
});