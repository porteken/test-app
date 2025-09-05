// For more info, see https://github.com/storybookjs/eslint-plugin-storybook#configuration-flat-config-format
import storybook from "eslint-plugin-storybook";

//ts-check
import pluginJs from "@eslint/js";
import nextPlugin from "@next/eslint-plugin-next";
import eslintConfigPrettier from "eslint-config-prettier";
import eslintPluginBetterTailwindcss from "eslint-plugin-better-tailwindcss";
import importPlugin from "eslint-plugin-import";
import perfectionist from "eslint-plugin-perfectionist";
import pluginPromise from "eslint-plugin-promise";
import pluginReact from "eslint-plugin-react";
import eslintPluginUnicorn from "eslint-plugin-unicorn";
import globals from "globals";
import tseslint from "typescript-eslint";
export default tseslint.config([
  {
    files: ["**/*.{js,mjs,cjs,ts,jsx,tsx}"],
  },
  {
    languageOptions: {
      ecmaVersion: "latest",
      globals: { ...globals.browser, ...globals.node },
    },
  },
  {
    settings: {
      react: {
        version: "detect",
      },
    },
  },
  tseslint.configs.recommended,
  pluginJs.configs.recommended,
  importPlugin.flatConfigs.recommended,
  pluginPromise.configs["flat/recommended"],
  pluginReact.configs.flat.recommended,
  pluginReact.configs.flat["jsx-runtime"],
  eslintConfigPrettier,
  eslintPluginUnicorn.configs.recommended,
  perfectionist.configs["recommended-natural"],
  {
    files: ["**/*.{jsx,tsx}"],
    languageOptions: {
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    plugins: {
      "better-tailwindcss": eslintPluginBetterTailwindcss,
    },
    rules: {
      // enable all recommended rules to report a warning
      ...eslintPluginBetterTailwindcss.configs["recommended-warn"].rules,
      // enable all recommended rules to report an error
      ...eslintPluginBetterTailwindcss.configs["recommended-error"].rules,
    },
    settings: {
      "better-tailwindcss": {
        // tailwindcss 4: the path to the entry file of the css based tailwind config (eg: `src/global.css`)
        entryPoint: "src/app/globals.css",
      },
    },
  },
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_" },
      ],
      "import/no-restricted-paths": [
        "error",
        {
          zones: [
            {
              from: "./src/app",
              target: "./src/features",
            },
            {
              from: ["./src/features", "./src/app"],
              target: [
                "./src/components",
                "./src/hooks",
                "./src/lib",
                "./src/types",
                "./src/utils",
                "./src/config",
                "./src/stores",
              ],
            },
            {
              from: ["./src/components", "./src/hooks", "./src/utils"],
              target: ["./src/features", "./src/app"],
            },
          ],
        },
      ],
      "import/no-unresolved": "off",
      "no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "react/jsx-uses-react": "error",
      "react/prop-types": "off",
      "unicorn/better-regex": "warn",
      "unicorn/no-null": "warn",
    },
  },
  {
    plugins: {
      "@next/next": nextPlugin,
    },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs["core-web-vitals"].rules,
    },
  },
  {
    ignores: [
      ".next/*",
      "next-env.d.ts",
      "src/__tests__/utils/*",
      "coverage/*",
    ],
  },
  {
    files: ["src/__tests__/**/*.{ts,tsx}"],
    rules: {
      "import/no-restricted-paths": "off",
    },
  },
], storybook.configs["flat/recommended"]);
