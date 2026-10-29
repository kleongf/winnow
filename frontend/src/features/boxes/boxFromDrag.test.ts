import { expect, test } from "vitest";

import { boxFromDrag } from "./boxFromDrag";

const FRAME = { width: 320, height: 180 };

test("a drag in any direction gives the same box", () => {
  const box = { x1: 100, y1: 60, x2: 140, y2: 90 };
  expect(boxFromDrag([100, 60], [140, 90], FRAME)).toEqual(box);
  expect(boxFromDrag([140, 90], [100, 60], FRAME)).toEqual(box);
});

test("a drag that leaves the frame is clamped to its edge", () => {
  expect(boxFromDrag([300, 170], [400, 250], FRAME)).toEqual({
    x1: 300,
    y1: 170,
    x2: 320,
    y2: 180,
  });
});

test("a click or a sliver is not a box", () => {
  expect(boxFromDrag([50, 50], [50, 50], FRAME)).toBeNull();
  expect(boxFromDrag([50, 50], [90, 51], FRAME)).toBeNull();
});
