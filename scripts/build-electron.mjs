import { build } from "esbuild";

// Bundles electron/main.ts (and its dependency on src/infrastructure/
// persistence/run-migrations.ts) into one CommonJS file Electron can load
// directly — native/runtime-provided modules stay external rather than
// bundled, since esbuild can't usefully inline a compiled .node binary.
await build({
  entryPoints: ["electron/main.ts"],
  outfile: "dist-electron/main.cjs",
  bundle: true,
  platform: "node",
  target: "node22",
  format: "cjs",
  external: ["electron", "electron-updater", "electron-log", "better-sqlite3"],
});

console.log("Built dist-electron/main.cjs");
