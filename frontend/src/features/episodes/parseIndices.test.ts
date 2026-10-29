import { expect, test } from "vitest";

import { parseIndices } from "./parseIndices";

test("reads indices and ranges separated by spaces or commas", () => {
  expect(parseIndices("3, 16 40-42")).toEqual({ ok: true, indices: [3, 16, 40, 41, 42] });
});

test("keeps each Episode once, in the order given", () => {
  expect(parseIndices("42 3 42 2-4")).toEqual({ ok: true, indices: [42, 3, 2, 4] });
});

test("names the first token it can't read", () => {
  expect(parseIndices("3 ep16 9-")).toEqual({ ok: false, error: 'Can\'t read "ep16"' });
  expect(parseIndices("5-2")).toEqual({ ok: false, error: 'Can\'t read "5-2"' });
});

test("needs at least one index", () => {
  expect(parseIndices("  ")).toEqual({ ok: false, error: "Enter at least one Episode index" });
});
