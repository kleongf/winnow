import type { Track, TrackBox } from "./useTracks";

/** SAM's box on the 5 fps frame showing at time `t`, or null where it found none. */
export function boxAt(track: Track, t: number): TrackBox | null {
  const frame = Math.min(Math.floor(t * track.fps + 1e-6), track.frames - 1);
  return track.boxes.find((box) => box.frame === frame) ?? null;
}

/** Why the track may have lost the object, in words, earliest first; empty if healthy. */
export function lossReasons(track: Track): string[] {
  const { health } = track;
  if (!health?.lost) return [];
  const at = (frames: number[]) => frames.map((f) => `${(f / track.fps).toFixed(1)} s`).join(", ");
  const reasons: string[] = [];
  if (health.area_jumps.length) reasons.push(`box swelled at ${at(health.area_jumps)}`);
  if (health.centre_jumps.length) reasons.push(`box jumped at ${at(health.centre_jumps)}`);
  if (health.missing_fraction > 0.2) {
    reasons.push(`no box on ${String(Math.round(health.missing_fraction * 100))}% of frames`);
  }
  return reasons;
}
