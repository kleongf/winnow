// Playwright's web server: the app on its own ports, against a fresh data dir and synthetic
// droid_100 Episodes, so e2e runs never touch real data or a dev server already running.
import { execFileSync } from "node:child_process";
import { rmSync } from "node:fs";
import { resolve } from "node:path";

import { serveUntilInterrupted, startServers } from "./servers.ts";

const E2E_FRONTEND_PORT = 5174;
const root = resolve("artifacts", "e2e-data");

rmSync(root, { recursive: true, force: true });
const fixtures = ["run", "--project", "backend", "winnow", "fixtures", resolve(root, "droid_100")];
execFileSync("uv", [...fixtures, "--episodes", "3"], { stdio: "inherit" });

const servers = await startServers({
  frontendPort: E2E_FRONTEND_PORT,
  backendPort: 8001,
  env: { DATA_DIR: resolve(root, "data"), DROID100_ROOT: resolve(root, "droid_100") },
});
await serveUntilInterrupted(servers);
