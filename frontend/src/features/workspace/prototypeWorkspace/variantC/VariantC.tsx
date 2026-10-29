// PROTOTYPE (throwaway): Variant C placeholder.
import type { Workspace } from "../fixture/useWorkspace";

export const name = "TBD";

export function VariantC(props: { ws: Workspace }) {
  return <div className="p-8">Variant C · {props.ws.results.length} Episodes</div>;
}
