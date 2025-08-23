/// <reference types="vitest" />
import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("src", import.meta.url)),
    },
  },
  test: {
    coverage: {
      exclude: [
        "node_modules/**",
        ".next/**",
        "tests/**",
        "src/utils/__tests__/test-utilities.ts",
        "src/config/supabase/**",
        "src/middleware.ts",
        "src/components/ui/**",
        "**/*types.ts",
        "**/constants.ts",
        "src/components/drag.tsx",
        "src/components/main.tsx",
        "src/components/edit.tsx",
      ],
      include: ["src/components/**/*.{ts,tsx}"],
      provider: "v8",
      reporter: ["text", "json", "html", "lcov"],
    },
    environment: "jsdom",
    exclude: [
      "node_modules/**",
      ".next/**",
      "tests/**",
      "src/utils/__tests__/test-utilities.ts",
      "src/app/**",
    ],
    globals: true,
    include: [
      "src/**/__tests__/**/*.test.{js,jsx,ts,tsx}",
      "src/**/*.test.{js,jsx,ts,tsx}",
      "!src/app/**",
    ],
    setupFiles: ["./vitest.setup.ts"],
  },
});
