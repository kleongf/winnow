// PROTOTYPE (throwaway): floating bar that cycles ?variant= on a prototype route. Dev builds only.
import { useEffect } from "react";

export function PrototypeSwitcher(props: {
  variants: { key: string; name: string }[];
  current: string;
  onChange: (key: string) => void;
}) {
  const { variants, current, onChange } = props;
  const index = Math.max(
    0,
    variants.findIndex((v) => v.key === current),
  );
  const step = (d: number) => {
    const next = variants[(index + d + variants.length) % variants.length];
    if (next) onChange(next.key);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el?.closest("input, textarea, [contenteditable]")) return;
      if (e.key === "ArrowLeft") step(-1);
      if (e.key === "ArrowRight") step(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!import.meta.env.DEV) return null;
  const v = variants[index];
  return (
    <div
      style={{
        position: "fixed",
        bottom: 16,
        left: "50%",
        transform: "translateX(-50%)",
        display: "flex",
        alignItems: "center",
        gap: 12,
        background: "#ff2d95",
        color: "#fff",
        padding: "8px 14px",
        borderRadius: 999,
        boxShadow: "0 6px 24px rgba(0,0,0,0.35)",
        font: "600 13px system-ui",
        zIndex: 1000,
      }}
    >
      <button onClick={() => step(-1)} style={arrow} aria-label="Previous variant">
        ←
      </button>
      <span>
        {v?.key} ({v?.name})
      </span>
      <button onClick={() => step(1)} style={arrow} aria-label="Next variant">
        →
      </button>
    </div>
  );
}

const arrow: React.CSSProperties = {
  background: "rgba(255,255,255,0.2)",
  border: 0,
  color: "#fff",
  borderRadius: 999,
  width: 28,
  height: 28,
  cursor: "pointer",
};
