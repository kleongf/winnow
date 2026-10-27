import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const backendUrl = process.env.WINNOW_BACKEND_URL ?? "http://127.0.0.1:8000";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: { "/api": backendUrl },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/testSetup.ts"],
  },
});
