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
  // into the bundle correctly on its own — no exclusions needed.
  output: "standalone",
};

export default nextConfig;
