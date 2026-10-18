import { describe, expect, it } from "vitest";
import { isEasyCode } from "@/lib/access-code";

describe("New and replacement access codes", () => {
  it("rejects ascending, descending and stepped sequences", () => {
    for (const code of ["1234", "4321", "0123", "7890", "2468", "8642"]) expect(isEasyCode(code)).toBe(true);
  });
  it("rejects repeated digits and duplicate pairs", () => {
    for (const code of ["1111", "0000", "1212", "4545", "1122"]) expect(isEasyCode(code)).toBe(true);
  });
  it("allows non-patterned four digit codes including a leading zero", () => {
    for (const code of ["0387", "5831", "1947"]) expect(isEasyCode(code)).toBe(false);
  });
});