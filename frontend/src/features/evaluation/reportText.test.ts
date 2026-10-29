import { describe, expect, it } from "vitest";

import { countOf, interval, lengthRuleText } from "./reportText";

describe("report text", () => {
  it("puts the count first and the interval separately, never ±", () => {
    const p = { count: 1, of: 2, low: 0.0945, high: 0.9055 };
    expect(countOf(p)).toBe("1 of 2");
    expect(interval(p)).toBe("0.09–0.91");
  });

  it("has no interval when there is nothing to count", () => {
    expect(interval({ count: 0, of: 0, low: null, high: null })).toBeNull();
  });

  it("states Length alone's hindsight threshold and side", () => {
    expect(lengthRuleText({ keep: "shorter", threshold_s: 12.4 })).toBe(
      "Length alone keeps Episodes ≤ 12.4 s (threshold set in hindsight).",
    );
    expect(lengthRuleText(null)).toMatch(/no labelled Episode/);
  });
});
