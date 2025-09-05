/// <reference types="vitest/config" />
/// <reference types="vitest" />
import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vitest/config";
import path from 'node:path';
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
const dirname = typeof __dirname !== 'undefined' ? __dirname : path.dirname(fileURLToPath(import.meta.url));

// More info at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("src", import.meta.url))
    }
  },
  test: {
    coverage: {
      exclude: ["node_modules/**", ".next/**", "tests/**", "src/utils/__tests__/test-utilities.ts", "src/config/supabase/**", "src/middleware.ts", "src/components/ui/**", "**/*types.ts", "**/constants.ts", "src/components/drag.tsx", "src/components/main.tsx", "src/components/edit.tsx"],
      include: ["src/components/**/*.{ts,tsx}"],
      provider: "v8",
      reporter: ["text", "json", "html", "lcov"]
    },
    environment: "jsdom",
    environmentOptions: {
      jsdom: {
        resources: "usable"
      }
    },
    exclude: ["node_modules/**", ".next/**", "tests/**", "src/utils/__tests__/test-utilities.ts", "src/app/**"],
    globals: true,
    hookTimeout: 10_000,
    include: ["src/**/__tests__/**/*.test.{js,jsx,ts,tsx}", "src/**/*.test.{js,jsx,ts,tsx}", "!src/app/**"],
    setupFiles: ["./vitest.setup.ts"],
    // React 19 specific configuration
    testTimeout: 10_000,
    projects: [{
      extends: true,
      plugins: [
      // The plugin will run tests for the stories defined in your Storybook config
      // See options at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon#storybooktest
      storybookTest({
        configDir: path.join(dirname, '.storybook')
      })],
      test: {
        name: 'storybook',
        browser: {
          enabled: true,
          headless: true,
          provider: 'playwright',
          instances: [{
            browser: 'chromium'
          }]
        },
        setupFiles: ['.storybook/vitest.setup.ts']
      }
    }]
  }
});