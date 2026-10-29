// The workspace's pages. The current one lives in `?page=` so reloads and links land there.
import { useEffect, useState } from "react";

export const datasetPages = ["prepare"] as const;
export const projectPages = ["describe", "episodes", "review", "evaluation"] as const;
export type Page = (typeof datasetPages)[number] | (typeof projectPages)[number];

export const pageLabels: Record<Page, string> = {
  prepare: "Prepare",
  describe: "Describe",
  episodes: "Episodes",
  review: "Review",
  evaluation: "Evaluation",
};

function isPage(value: string | null): value is Page {
  return value !== null && Object.hasOwn(pageLabels, value);
}

export function readPage(search: string = globalThis.location.search): Page {
  const value = new URLSearchParams(search).get("page");
  return isPage(value) ? value : "prepare";
}

export function usePage(): [Page, (page: Page) => void] {
  const [page, setPage] = useState(() => readPage());

  useEffect(() => {
    const onPopState = () => {
      setPage(readPage());
    };
    globalThis.addEventListener("popstate", onPopState);
    return () => {
      globalThis.removeEventListener("popstate", onPopState);
    };
  }, []);

  const go = (next: Page) => {
    const url = new URL(globalThis.location.href);
    url.searchParams.set("page", next);
    globalThis.history.pushState(null, "", url);
    setPage(next);
  };
  return [page, go];
}
