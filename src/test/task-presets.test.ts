import { describe, expect, it } from "vitest";
import { applyPreset } from "@/lib/tasks";

describe("Personal action list and counter", () => {
  it("includes waiting approval plus waiting decision, independent of assignee", () => {
    const calls: unknown[][] = [];
    const q = {
      eq: (...args: unknown[]) => { calls.push(["eq", ...args]); return q; },
      not: (...args: unknown[]) => { calls.push(["not", ...args]); return q; },
      lt: (...args: unknown[]) => { calls.push(["lt", ...args]); return q; },
      in: (...args: unknown[]) => { calls.push(["in", ...args]); return q; },
    };
    applyPreset(q, "my_action", "current-user");
    expect(calls).toEqual([["eq", "archived", false], ["in", "status", ["waiting_approval", "waiting_decision"]]]);
  });
});
import { presetsForRole, attentionPresetFor } from "@/lib/tasks";
describe("role presets", () => {
  it("staff see 'my_action' and never safety", () => {
    expect(attentionPresetFor("staff")).toBe("my_action");
    expect(presetsForRole("staff")).not.toContain("safety");
    expect(presetsForRole("staff")).toContain("my_action");
  });
  it("no role sees an overdue view", () => {
    expect(presetsForRole("staff")).not.toContain("overdue");
    expect(presetsForRole("super_admin")).not.toContain("overdue");
  });
});
