import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
  },
  // Self-contained server bundle (.next/standalone) — the Electron main
  // process spawns this directly rather than needing the full node_modules
  // tree or the `next` CLI inside the packaged app. Next's file tracing
  // copies better-sqlite3's compiled binary and playwright's package code
  // into the bundle correctly on its own, EXCEPT for one file it can't see
  // statically: playwright-core requires its own browsers.json (a plain
  // data file, not a module import file tracing can follow) at runtime to
  // resolve browser download paths. Without this explicit include, a real
  // packaged app threw "Cannot find module
  // .../playwright-core/browsers.json" on every request that touched any
  // route importing the crawler (even indirectly) — confirmed live.
  outputFileTracingIncludes: {
    "/**": ["./node_modules/playwright-core/browsers.json"],
  },
  output: "standalone",
};

export default nextConfig;
