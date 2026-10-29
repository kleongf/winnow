// Which set an Episode is in, as a small tag; nothing for Episodes in neither.
import { SET_LABELS, type SetName } from "./useSets";

export function SetTag(props: { name: SetName | undefined }) {
  if (!props.name) return null;
  return (
    <span className="rounded border px-1.5 py-0.5 text-[11px] whitespace-nowrap text-muted-foreground">
      {SET_LABELS[props.name]}
    </span>
  );
}
