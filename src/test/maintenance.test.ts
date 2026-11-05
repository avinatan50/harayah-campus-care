import { describe, expect, it } from "vitest";
import { currentCycleStart, nextCycleStart, progress } from "@/lib/maintenance";

describe("maintenance cycles", () => {
  it("monthly cycle rolls over on the anchor day", () => {
    expect(currentCycleStart("2026-01-10", 1, new Date("2026-03-09T12:00:00Z"))).toBe("2026-02-10");
    expect(currentCycleStart("2026-01-10", 1, new Date("2026-03-10T12:00:00Z"))).toBe("2026-03-10");
  });
  it("half-yearly cycle stays in the first period for six months", () => {
    expect(currentCycleStart("2026-01-01", 6, new Date("2026-06-30T12:00:00Z"))).toBe("2026-01-01");
    expect(currentCycleStart("2026-01-01", 6, new Date("2026-07-01T12:00:00Z"))).toBe("2026-07-01");
  });
  it("next cycle and partial progress", () => {
    expect(nextCycleStart("2026-11-05", 12)).toBe("2027-11-05");
    expect(progress(3, 8)).toBe(38);
  });
});
