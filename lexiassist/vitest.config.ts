// vitest.config.ts
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
  resolve: {
    alias: {
      // Matches the "@/*" -> "./src/*" path mapping in tsconfig.json.
      "@": path.resolve(__dirname, "./src"),
    },
  },
});