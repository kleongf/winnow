// Drag a box on a still frame. Reused by Prepare's box dialog and by Reference label mode.
// Coordinates are frame pixels (the image's natural size), whatever size it's shown at.
import { useRef, useState, type PointerEvent } from "react";

import { cn } from "@/lib/utils";

import { boxFromDrag, type Point, type Rect } from "./boxFromDrag";

interface Frame {
  width: number;
  height: number;
}

export function BoxCanvas(props: {
  src: string;
  box: Rect | null;
  onDraw: (box: Rect) => void;
  className?: string;
}) {
  const image = useRef<HTMLImageElement>(null);
  const [frame, setFrame] = useState<Frame | null>(null);
  const [drag, setDrag] = useState<{ start: Point; end: Point } | null>(null);

  const toFrame = (event: PointerEvent<HTMLDivElement>, { width, height }: Frame): Point => {
    const bounds = event.currentTarget.getBoundingClientRect();
    return [
      ((event.clientX - bounds.left) / bounds.width) * width,
      ((event.clientY - bounds.top) / bounds.height) * height,
    ];
  };
  const dragging = drag && frame ? boxFromDrag(drag.start, drag.end, frame) : null;
  const shown = dragging ?? props.box;

  return (
    <div
      data-testid="box-canvas"
      className={cn(
        "relative aspect-video w-full cursor-crosshair touch-none overflow-hidden rounded bg-black select-none",
        props.className,
      )}
      onPointerDown={(event) => {
        // Read the size now rather than wait for onLoad, which may not have fired yet.
        const size = image.current?.naturalWidth
          ? { width: image.current.naturalWidth, height: image.current.naturalHeight }
          : null;
        if (!size) return;
        setFrame(size);
        event.currentTarget.setPointerCapture(event.pointerId);
        const at = toFrame(event, size);
        setDrag({ start: at, end: at });
      }}
      onPointerMove={(event) => {
        if (drag && frame) setDrag({ ...drag, end: toFrame(event, frame) });
      }}
      onPointerUp={() => {
        if (dragging) props.onDraw(dragging);
        setDrag(null);
      }}
    >
      <img
        ref={image}
        src={props.src}
        alt="Frame 0"
        draggable={false}
        onLoad={(event) => {
          const loaded = event.currentTarget;
          setFrame({ width: loaded.naturalWidth, height: loaded.naturalHeight });
        }}
        className="pointer-events-none absolute inset-0 h-full w-full object-contain"
      />
      {frame && shown && (
        <svg
          viewBox={`0 0 ${String(frame.width)} ${String(frame.height)}`}
          className="pointer-events-none absolute inset-0 h-full w-full"
        >
          <rect
            x={shown.x1}
            y={shown.y1}
            width={shown.x2 - shown.x1}
            height={shown.y2 - shown.y1}
            fill="rgba(80,200,255,0.2)"
            stroke="#50c8ff"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      )}
    </div>
  );
}
