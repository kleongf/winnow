// A drag on the frame, from where the pointer went down to where it is, as a box in frame
// pixels: corners in order, clamped to the frame, and null when too small for SAM to track.
export interface Rect {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export type Point = [x: number, y: number];

export const MIN_SIDE_PX = 3; // matches the backend's check

const clamp = (v: number, max: number) => Math.max(0, Math.min(max, Math.round(v)));

export function boxFromDrag(
  start: Point,
  end: Point,
  frame: { width: number; height: number },
): Rect | null {
  const [ax, ay] = [clamp(start[0], frame.width), clamp(start[1], frame.height)];
  const [bx, by] = [clamp(end[0], frame.width), clamp(end[1], frame.height)];
  const box = {
    x1: Math.min(ax, bx),
    y1: Math.min(ay, by),
    x2: Math.max(ax, bx),
    y2: Math.max(ay, by),
  };
  const bigEnough = box.x2 - box.x1 >= MIN_SIDE_PX && box.y2 - box.y1 >= MIN_SIDE_PX;
  return bigEnough ? box : null;
}
