// electron-builder afterPack hook — CommonJS since electron-builder requires
// hook scripts with `require()`, unlike build-electron.mjs (an ESM script we
// invoke ourselves via `node`).
//
// Fixes two confirmed gaps in the packaged app, both only caught by
// actually launching a real packaged build (not just checking that
// packaging itself succeeds):
//
// 1. When a directory copied via extraResources itself contains a
//    "node_modules" folder, electron-builder silently drops that inner
//    node_modules rather than copying it verbatim (its own dependency-
//    collection/pruning logic only resolves node_modules trees reachable
//    from this project's own package.json — .next/standalone's
//    node_modules is a separate, self-contained tree Next.js already
//    assembled, and isn't reachable that way). Without this,
//    standalone/node_modules is missing entirely and `require("next")` in
//    standalone/server.js throws MODULE_NOT_FOUND — the app can never
//    start at all.
// 2. Next.js's own standalone-output docs state static assets are NOT
//    included in .next/standalone by design (kept out to shrink it) —
//    .next/static and public/ must be copied in manually alongside it.
//    Without this, the server itself runs fine, but every page loads with
//    no CSS/JS (raw unstyled HTML) since every /_next/static/* and
//    public asset request 404s.
const fs = require("fs");
const path = require("path");

function copyDir(source, dest) {
  fs.rmSync(dest, { recursive: true, force: true });
  fs.cpSync(source, dest, { recursive: true });
}

module.exports = async function afterPack(context) {
  const resourcesDir =
    context.electronPlatformName === "darwin"
      ? path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`, "Contents", "Resources")
      : path.join(context.appOutDir, "resources");

  const projectDir = context.packager.projectDir;
  const standaloneDest = path.join(resourcesDir, "standalone");

  const sourceModules = path.join(projectDir, ".next", "standalone", "node_modules");
  if (!fs.existsSync(sourceModules)) {
    throw new Error(`afterPack: expected ${sourceModules} to exist — did "next build" run first?`);
  }
  copyDir(sourceModules, path.join(standaloneDest, "node_modules"));
  console.log(`afterPack: copied standalone/node_modules`);

  const sourceStatic = path.join(projectDir, ".next", "static");
  if (!fs.existsSync(sourceStatic)) {
    throw new Error(`afterPack: expected ${sourceStatic} to exist — did "next build" run first?`);
  }
  copyDir(sourceStatic, path.join(standaloneDest, ".next", "static"));
  console.log(`afterPack: copied .next/static into standalone/.next/static`);

  const sourcePublic = path.join(projectDir, "public");
  if (fs.existsSync(sourcePublic)) {
    copyDir(sourcePublic, path.join(standaloneDest, "public"));
    console.log(`afterPack: copied public/ into standalone/public`);
  }
};
