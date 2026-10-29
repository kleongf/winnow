import { expect, test } from "vitest";

import { boxAt, lossReasons } from "./trackBoxes";
import type { Track } from "./useTracks";

function track(overrides: Partial<Track> = {}): Track {
  return {
    episode_id: "droid_100:0",
    kind: "wrist",
    camera: "wrist_image_left",
    status: "tracked",
    fps: 5,
    frames: 15,
    width: 320,
    height: 180,
    seed_frame: 5,
    boxes: [0, 1, 2, 14].map((frame) => ({
      frame,
      left: 100 + frame,
      top: 80,
      right: 140 + frame,
      bottom: 120,
    })),
    health: { area_jumps: [], centre_jumps: [], missing_fraction: 0, lost: false },
    ...overrides,
  };
}

test("the box shown is the 5 fps frame the playhead is in", () => {
  expect(boxAt(track(), 0)?.frame).toBe(0);
  expect(boxAt(track(), 0.39)?.frame).toBe(1);
  expect(boxAt(track(), 0.4)?.frame).toBe(2); // exactly on a frame boundary
});

test("frames SAM found nothing on show no box, and the end holds the last frame", () => {
  expect(boxAt(track(), 1.0)).toBeNull();
  expect(boxAt(track(), 3.0)?.frame).toBe(14);
});

test("a healthy track has no loss reasons; a lost one names each pattern and when", () => {
  expect(lossReasons(track())).toEqual([]);
  const health = { area_jumps: [12], centre_jumps: [3, 4], missing_fraction: 0.25, lost: true };
  expect(lossReasons(track({ health }))).toEqual([
    "box swelled at 2.4 s",
    "box jumped at 0.6 s, 0.8 s",
    "no box on 25% of frames",
  ]);
});
