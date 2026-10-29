// The workspace's pages. The current one lives in `?page=` so reloads and links land there.
import { navigate, useSearchParams } from "./url";

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

export function readPage(params: URLSearchParams): Page {
  const value = params.get("page");
  return isPage(value) ? value : "prepare";
}

export function usePage(): [Page, (page: Page) => void] {
  const params = useSearchParams();
  // Changing page leaves any open Episode.
  const go = (page: Page) => {
    navigate({ page, episode: null, t: null });
  };
  return [readPage(params), go];
}
