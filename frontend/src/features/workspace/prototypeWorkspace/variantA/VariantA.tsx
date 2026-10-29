// PROTOTYPE (throwaway): Variant A placeholder.
import type { Workspace } from "../fixture/useWorkspace";

export const name = "TBD";

export function VariantA(props: { ws: Workspace }) {
  return <div className="p-8">Variant A · {props.ws.results.length} Episodes</div>;
}
