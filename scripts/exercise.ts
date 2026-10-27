// `pnpm exercise <path> [--click <text>]...`: open a page in a real browser, click through it,
// and save a screenshot after each step plus console and network errors to artifacts/exercise/.
// Exits non-zero if the page logged errors or any request failed.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { chromium } from "@playwright/test";

import { FRONTEND_URL, startServers } from "./servers.ts";

function parseArgs(argv: string[]): { path: string; clicks: string[] } {
  const [path = "/", ...rest] = argv;
  const clicks: string[] = [];
  for (let i = 0; i < rest.length; i += 2) {
    const value = rest[i + 1];
    if (rest[i] !== "--click" || value === undefined) {
      throw new Error("Usage: pnpm exercise <path> [--click <text>]...");
    }
    clicks.push(value);
  }
  return { path, clicks };
}

const { path, clicks } = parseArgs(process.argv.slice(2));
const outDir = join(
  "artifacts",
  "exercise",
  path.replace(/^\/+/, "").replace(/[^\w-]+/g, "_") || "root",
);
mkdirSync(outDir, { recursive: true });

const servers = await startServers();
const browser = await chromium.launch();
const errors: string[] = [];
const consoleLines: string[] = [];
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on("console", (msg) => {
    consoleLines.push(`[${msg.type()}] ${msg.text()}`);
    if (msg.type() === "error") errors.push(`console: ${msg.text()}`);
  });
  page.on("pageerror", (err) => errors.push(`pageerror: ${err.message}`));
  page.on("requestfailed", (req) => errors.push(`requestfailed: ${req.method()} ${req.url()}`));
  page.on("response", (res) => {
    if (res.status() >= 400) errors.push(`http ${String(res.status())}: ${res.url()}`);
  });

  await page.goto(FRONTEND_URL + path, { waitUntil: "networkidle" });
  await page.screenshot({ path: join(outDir, "00-loaded.png"), fullPage: true });
  for (const [index, text] of clicks.entries()) {
    await page.getByText(text, { exact: true }).first().click();
    await page.waitForLoadState("networkidle");
    const name = `${String(index + 1).padStart(2, "0")}-${text.replace(/\W+/g, "_")}.png`;
    await page.screenshot({ path: join(outDir, name), fullPage: true });
  }
} finally {
  await browser.close();
  servers.stop();
}

writeFileSync(join(outDir, "console.txt"), consoleLines.join("\n") + "\n");
writeFileSync(join(outDir, "errors.txt"), errors.join("\n") + "\n");
console.log(`Saved screenshots and logs to ${outDir}`);
if (errors.length > 0) {
  console.error(`${String(errors.length)} error(s):\n${errors.join("\n")}`);
  process.exit(1);
}
