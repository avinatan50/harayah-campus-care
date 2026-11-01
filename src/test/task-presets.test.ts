import { describe, expect, it } from "vitest";
import { applyPreset, initialStatusFor, type Task } from "@/lib/tasks";
import { matchesPreset } from "@/lib/reports";

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
  it('totals approval and decision items with any assignee and excludes archive', () => {
    const rows = [
      { status: 'waiting_approval', archived: false, assignee_id: null },
      { status: 'waiting_decision', archived: false, assignee_id: 'someone-else' },
      { status: 'in_progress', archived: false, assignee_id: 'current-user' },
      { status: 'waiting_approval', archived: true, assignee_id: null },
    ] as Task[];
    expect(rows.filter(t => matchesPreset(t, 'my_action')).length).toBe(2);
    expect(rows.filter(t => matchesPreset(t, 'my_action')).length).toBe(rows.filter(t => matchesPreset(t, 'waiting_approval')).length + rows.filter(t => matchesPreset(t, 'waiting_decision')).length);
  });
  it('new requests always wait for approval despite an explicit status', () => {
    expect(initialStatusFor('request', 'closed')).toBe('waiting_approval');
  });
  it('new decisions always wait for decision despite an explicit status', () => {
    expect(initialStatusFor('decision', 'new')).toBe('waiting_decision');
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
