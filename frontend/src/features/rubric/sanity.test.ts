import { describe, expect, it } from "vitest";

import { failRateLine } from "./sanity";

describe("failRateLine", () => {
  it("reads the count, the rate and the Wilson interval", () => {
    const line = failRateLine({ count: 1, of: 20, low: 0.0089, high: 0.2361 });
    expect(line).toBe("1 of 20 fail · 5% (95% interval 0.9%–23.6%)");
  });

  it("has no interval for an empty pool", () => {
    expect(failRateLine({ count: 0, of: 0, low: null, high: null })).toBe("0 of 0 fail");
  });
});
