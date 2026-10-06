import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      // Tests execute server modules outside Next's compiler. Retain production
      // server-only guards while resolving their bundled server no-op here.
      "server-only": path.resolve(__dirname, "node_modules/next/dist/compiled/server-only/empty.js"),
    },
  },
  test: {
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
