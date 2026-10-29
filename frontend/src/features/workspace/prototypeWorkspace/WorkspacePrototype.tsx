// PROTOTYPE (throwaway): three workspace shapes around the Workstation Episode detail view, on
// /prototype/workspace, switchable via ?variant=A|B|C. All variants share one in-memory state.
import { useState } from "react";

import { TooltipProvider } from "@/components/ui/tooltip";

import { PrototypeSwitcher } from "../../core/PrototypeSwitcher";
import { useWorkspace } from "./fixture/useWorkspace";
import * as A from "./variantA/VariantA";
import * as B from "./variantB/VariantB";
import * as C from "./variantC/VariantC";

const variants = [
  { key: "A", name: A.name, View: A.VariantA },
  { key: "B", name: B.name, View: B.VariantB },
  { key: "C", name: C.name, View: C.VariantC },
];

export function WorkspacePrototype() {
  const ws = useWorkspace();
  const [current, setCurrent] = useState(
    () => new URLSearchParams(window.location.search).get("variant") ?? "A",
  );
  const change = (key: string) => {
    const url = new URL(window.location.href);
    url.searchParams.set("variant", key);
    window.history.replaceState(null, "", url);
    setCurrent(key);
  };
  const { View } = variants.find((v) => v.key === current) ?? variants[0]!;
  return (
    <TooltipProvider>
      <View ws={ws} />
      <PrototypeSwitcher variants={variants} current={current} onChange={change} />
    </TooltipProvider>
  );
}
