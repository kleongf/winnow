import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

import { HealthStatus } from "./HealthStatus";

afterEach(() => {
  vi.unstubAllGlobals();
});

function renderWithQuery() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <HealthStatus />
    </QueryClientProvider>,
  );
}

test("shows whether the Meta API key is configured", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(() => Promise.resolve(Response.json({ status: "ok", meta_api_key_configured: true }))),
  );
  renderWithQuery();

  expect(await screen.findByTestId("health-status")).toHaveTextContent("key configured");
});

test("reports an unreachable backend", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(() => Promise.resolve(new Response(null, { status: 502 }))),
  );
  renderWithQuery();

  expect(await screen.findByRole("alert")).toHaveTextContent("Backend unreachable");
});
