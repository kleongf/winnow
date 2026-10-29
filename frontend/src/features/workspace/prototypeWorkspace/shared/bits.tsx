// PROTOTYPE (throwaway): tiny shared presentational pieces (status colours, badges, box drawing).
import { useRef, useState } from "react";

import { cn } from "@/lib/utils";

import type { Rect } from "../fixture/episodes";
import type { Status, Triage } from "../fixture/rubric";

export const statusClass: Record<Status, string> = {
  pass: "text-emerald-700 dark:text-emerald-400",
  fail: "text-orange-700 dark:text-orange-400",
  unsure: "text-amber-600 dark:text-amber-400",
};

export const statusBg: Record<Status, string> = {
  pass: "bg-emerald-600",
  fail: "bg-orange-600",
  unsure: "bg-amber-500",
};

export const triageClass: Record<Triage, string> = {
  Keep: "bg-emerald-600 text-white",
  Reject: "bg-orange-600 text-white",
  "Needs review": "bg-amber-500 text-black",
};

export function StatusText(props: { status: Status; className?: string }) {
  return (
    <span className={cn("text-xs font-bold uppercase", statusClass[props.status], props.className)}>
      {props.status}
    </span>
  );
}

export function TriageBadge(props: { triage: Triage; className?: string }) {
  return (
    <span
      className={cn(
        "inline-block rounded px-2 py-0.5 text-xs font-semibold whitespace-nowrap",
        triageClass[props.triage],
        props.className,
      )}
    >
      {props.triage}
    </span>
  );
}

/**
 * Frame 0 with click-drag box drawing in the 320×180 frame's own coordinates.
 * Calls onDraw on mouse-up with a box at least 3 px on each side.
 */
export function BoxCanvas(props: {
  src: string;
  rect: Rect | null;
  onDraw: (rect: Rect) => void;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<Rect | null>(null);
  const toFrame = (e: React.PointerEvent): [number, number] => {
    const b = ref.current!.getBoundingClientRect();
    return [
      Math.round(((e.clientX - b.left) / b.width) * 320),
      Math.round(((e.clientY - b.top) / b.height) * 180),
    ];
  };
  const shown = drag ?? props.rect;
  const norm = (r: Rect): Rect => [
    Math.min(r[0], r[2]),
    Math.min(r[1], r[3]),
    Math.max(r[0], r[2]),
    Math.max(r[1], r[3]),
  ];
  return (
    <div
      ref={ref}
      className={cn(
        "relative aspect-video w-full cursor-crosshair touch-none overflow-hidden rounded bg-black select-none",
        props.className,
      )}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        const [x, y] = toFrame(e);
        setDrag([x, y, x, y]);
      }}
      onPointerMove={(e) => {
        if (!drag) return;
        const [x, y] = toFrame(e);
        setDrag([drag[0], drag[1], x, y]);
      }}
      onPointerUp={() => {
        if (drag) {
          const r = norm(drag);
          if (r[2] - r[0] >= 3 && r[3] - r[1] >= 3) props.onDraw(r);
        }
        setDrag(null);
      }}
    >
      <img
        src={props.src}
        alt=""
        draggable={false}
        className="pointer-events-none absolute inset-0 h-full w-full object-cover"
      />
      {shown && (
        <svg viewBox="0 0 320 180" className="pointer-events-none absolute inset-0 h-full w-full">
          {(() => {
            const r = norm(shown);
            return (
              <rect
                x={r[0]}
                y={r[1]}
                width={r[2] - r[0]}
                height={r[3] - r[1]}
                fill="rgba(80,200,255,0.2)"
                stroke="#50c8ff"
              />
            );
          })()}
        </svg>
      )}
    </div>
  );
}
