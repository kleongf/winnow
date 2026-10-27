// `pnpm dev`: run backend (with reload) and frontend until interrupted.
import { FRONTEND_URL, startServers } from "./servers.ts";

const servers = await startServers({ reload: true });
console.log(`\nWinnow is up at ${FRONTEND_URL}\n`);

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    servers.stop();
    process.exit(0);
  });
}
await new Promise(() => undefined);
