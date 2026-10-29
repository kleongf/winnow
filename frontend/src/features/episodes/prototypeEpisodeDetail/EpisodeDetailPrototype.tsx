// PROTOTYPE (throwaway): three Episode detail view variants on /prototype/episode-detail,
// switchable via ?variant=A|B|C, against real droid_100 Episode 42 data.
import { useState } from "react";

import { PrototypeSwitcher } from "../../core/PrototypeSwitcher";
import * as A from "./VariantA";
import * as B from "./VariantB";
import * as C from "./VariantC";

const variants = [
  { key: "A", name: A.name, View: A.VariantA },
  { key: "B", name: B.name, View: B.VariantB },
  { key: "C", name: C.name, View: C.VariantC },
];

export function EpisodeDetailPrototype() {
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
    <>
      <View key={current} />
      <PrototypeSwitcher variants={variants} current={current} onChange={change} />
    </>
  );
}
