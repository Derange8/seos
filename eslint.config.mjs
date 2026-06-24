import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // The codebase already names intentionally-unused params with a
    // leading underscore (e.g. route handlers' `_request`, test fakes'
    // `_message`) — formalize that convention here so it's actually
    // enforced, instead of only working by accident (default
    // "after-used" mode happens to skip an unused param only when a
    // later one in the same signature is used).
    rules: {
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // esbuild-bundled Electron main process output — generated, not source.
    "dist-electron/**",
  ]),
]);

export default eslintConfig;
