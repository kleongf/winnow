// Starts the backend and frontend dev servers and waits until both answer.
import { spawn, type ChildProcess } from "node:child_process";

export const FRONTEND_URL = "http://127.0.0.1:5173";
const HEALTH_URL = `${FRONTEND_URL}/api/health`; // proxied, so it only answers once both are up

export interface Servers {
  stop: () => void;
}

async function isUp(): Promise<boolean> {
  try {
    return (await fetch(HEALTH_URL)).ok;
  } catch {
    return false;
  }
}

export async function startServers(options: { reload?: boolean } = {}): Promise<Servers> {
  if (await isUp()) return { stop: () => undefined }; // reuse servers someone else started

  const backendArgs = ["run", "--project", "backend", "uvicorn", "winnow.app:app"];
  backendArgs.push("--host", "127.0.0.1", "--port", "8000");
  if (options.reload) backendArgs.push("--reload", "--reload-dir", "backend/src");

  const children: ChildProcess[] = [
    spawn("uv", backendArgs, { stdio: "inherit" }),
    spawn("pnpm", ["--filter", "winnow-frontend", "dev"], { stdio: "inherit" }),
  ];
  const stop = () => {
    for (const child of children) child.kill("SIGTERM");
  };

  const deadline = Date.now() + 60_000;
  while (!(await isUp())) {
    if (Date.now() > deadline) {
      stop();
      throw new Error(`Servers did not come up at ${HEALTH_URL} within 60s`);
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return { stop };
}
