# Releasing a new version

Seos ships as a packaged Electron app (macOS/Windows/Linux) that checks
`Derange8/seos`'s GitHub Releases for updates on every launch
(`autoUpdater.checkForUpdatesAndNotify()` in `electron/main.ts`).

**Verified end-to-end on 2026-07-06** by actually publishing `v0.1.1` and
`v0.1.2` and confirming the real anonymous feed URL electron-updater uses
(`github.com/<owner>/<repo>/releases/latest/download/latest-mac.yml`)
correctly resolves to the newer version and its asset is downloadable with
no credentials — see the two real findings below, both already fixed.

## Real gap found and fixed: the repo must be public

`electron-updater`'s default `GitHubProvider` makes **fully anonymous**
HTTP requests for the update feed and installer assets — it never sends a
token, because a real end user's machine has no GitHub credentials at all.
GitHub returns `404` for release assets on a **private** repo to an
unauthenticated request, even a valid Personal Access Token used the wrong
way (the plain `browser_download_url` doesn't work for a private repo
either — only the `/releases/assets/{id}` API endpoint with an
`Accept: application/octet-stream` header does, and only electron-updater's
separate `PrivateGitHubProvider` — not the default provider actually wired
up in `electron/main.ts` — knows how to do that). **`Derange8/seos` was
private and was made public on 2026-07-06 specifically to fix this** — a
packaged app's installers are meant to be publicly distributed anyway, so
this isn't a real trade-off, just a previously-missed prerequisite.

If this project's repo is ever made private again for some other reason,
auto-update will silently stop working for all existing installs unless
`electron/main.ts` is changed to construct a `PrivateGitHubProvider` with a
token instead — a real code change, not a config flip.

## Known bug in electron-builder's publish step: duplicate draft releases

Both real publish runs (`v0.1.1` and `v0.1.2`) produced **two draft
releases under the same tag** — a real race in electron-builder's own
GitHub-publish step (parallel asset uploads each independently decided "no
release exists yet, create one"). One draft ends up with only 1 stray
asset (usually a `.blockmap`); the other has the complete set including
`latest-mac.yml`. **After every publish, check for this before moving on**:

```bash
curl -s -H "Authorization: token $GH_TOKEN" \
  https://api.github.com/repos/Derange8/seos/releases | python3 -c "
import sys, json
for r in json.load(sys.stdin):
    print(r['id'], r['tag_name'], r['draft'], [a['name'] for a in r['assets']])
"
```

If two drafts share a tag: delete the incomplete one
(`DELETE /repos/Derange8/seos/releases/{id}`), then un-draft the complete
one (`PATCH /repos/Derange8/seos/releases/{id}` with `{"draft": false}`).
Skipping this leaves the release in draft state, which electron-updater's
anonymous feed request cannot see at all (drafts aren't returned by
`/releases/latest`).

## One-time setup

1. **Create a GitHub Personal Access Token** with `repo` scope (classic) or
   `contents: write` (fine-grained) for `Derange8/seos`.
2. Export it in the shell you'll publish from:
   ```bash
   export GH_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx
   ```
   Never commit this token or put it in `.env` — it's a publish credential,
   not an app runtime secret.

## Cutting a release

1. **Bump the version** in `package.json` (`"version"` field) — semver,
   e.g. `0.1.0` → `0.1.1`. electron-updater compares this against each
   installed copy's own version to decide whether an update is available.
2. **Commit and push** the version bump (and anything else going into the
   release) to `main` as normal.
3. **Build and publish**:
   ```bash
   npm run electron:dist:publish
   ```
   This runs `next build` → bundles `electron/main.ts` → `electron-builder
   --publish always`, which builds the installer for the current platform
   and uploads it as a new GitHub Release (tag `vX.Y.Z`, matching
   `package.json`'s version) on `Derange8/seos`, including the
   `latest-mac.yml`/`latest.yml` metadata files electron-updater's
   auto-update check reads.
   - Only builds for **the platform you run this on** — a real multi-platform
     release needs this run once per target OS (mac/win/linux), or a CI
     matrix doing the same. Not set up yet; this repo has no CI workflow
     for it.
   - The app is unsigned (no Apple Developer ID / Windows code-signing
     certificate configured) — this is a deliberate, already-made scope
     decision (see project notes: code signing is out of scope until
     public distribution, "friends, for now"). Recipients will see an
     OS unsigned-app warning on first launch.

## Verifying the update actually works

**Fully verified end-to-end on a real machine on 2026-07-06.** Installed a
real packaged `v0.1.1` build, launched it, and confirmed via
`~/Library/Logs/Seos/main.log` (with `autoUpdater.logger = log` wired up —
see the fix below, without it electron-updater's own events go nowhere
since a packaged GUI app has no attached console) that it: checked GitHub,
found `v0.1.2`, downloaded the real installer asset, and got as far as
attempting to install it. Three real, previously-unknown packaging bugs
were found and fixed in the process — **the app could not even launch
successfully before these fixes**:

### Bug 1: packaged app couldn't start at all — `standalone/node_modules` was missing

`electron-builder`'s `extraResources` copy step silently drops an inner
`node_modules` folder found inside a copied directory — confirmed by
inspecting a real packaged `.app`: `Resources/standalone/` only ever
contained `package.json` + `server.js`, `node_modules` missing every
time, even after adding an explicit `filter: ["**/*"]` (no effect). Without
it, `standalone/server.js`'s own `require("next")` throws
`MODULE_NOT_FOUND` and the Next.js server inside the packaged app can
never start — every launch just failed after a 20s timeout with no
useful error surfaced anywhere. **Fixed** via a new `afterPack` hook
(`scripts/after-pack.cjs`) that copies `.next/standalone/node_modules`
into the packaged app itself, once electron-builder's own copy/prune step
is done.

### Bug 2: even after fixing #1, spawning the server never actually worked

`electron/main.ts` spawns the Next.js server via
`spawn(process.execPath, [...])`. In dev, `process.execPath` is the system
`node` binary — fine. **In a packaged app, `process.execPath` IS the
Electron binary itself** — so the spawned "server" process was actually
launching a second full Electron instance, not running `server.js` as a
plain Node script, and the real server never came up (still a 20s
timeout, still no evidence of *why* in the logs). **Fixed** by adding
`ELECTRON_RUN_AS_NODE: "1"` to the spawned process's env — this is the
documented way to make Electron's own binary behave as a plain Node
runtime for a spawned child process.

### Bug 3: server started, but every page loaded with no CSS/JS at all

Next.js's own standalone-output docs state static assets are deliberately
**not** included in `.next/standalone` (kept out to shrink it) —
`.next/static` and `public/` must be copied in manually alongside it. This
codebase's packaging never did that, so `/_next/static/*` and public
asset requests all 404'd — the app "worked" (server up, HTML returned)
but rendered as unstyled raw text. **Fixed** in the same `afterPack` hook:
it now also copies `.next/static` → `standalone/.next/static` and
`public/` → `standalone/public`.

### Bug 4 (a gap, not a defect): the update-check itself was invisible in the log

`electron-updater` logs to plain `console` by default, which goes nowhere
useful in a packaged GUI app (no attached terminal) — so there was
previously no way to tell from `main.log` whether the update check ran at
all, found nothing, or errored. **Fixed** by wiring
`autoUpdater.logger = log` (the existing `electron-log` instance already
used elsewhere in `main.ts`) plus explicit listeners on
`checking-for-update`/`update-available`/`update-not-available`/`error`/
`download-progress`/`update-downloaded`.

### The one remaining, expected limitation: unsigned installs can't self-update

With all four fixes in place, a real `v0.1.1` install correctly found,
downloaded, and attempted to install `v0.1.2` — and then hit a real macOS
Gatekeeper rejection at the final install step:

```
Error: Code signature at URL file:///.../Seos.app/ did not pass validation:
kodda kaynak yok ama imza olması gerektiğini belirtiyor
```

This is **expected, not a bug**: macOS's native updater mechanism
(Squirrel.Mac, which electron-updater uses under the hood on macOS)
requires the old and new app bundles to have a valid, matching code
signature before it will swap them in place — an unsigned app fails this
check by design, regardless of how correct everything upstream of it is.
Code signing (an Apple Developer ID certificate, $99/yr program
membership) remains the same deliberate, already-scoped-out item it was
before this session — "out of scope until public distribution." **The
practical takeaway**: right now, a friend who installs a build can be
told a new version exists (the app-side detection genuinely works), but
they'll need to manually download and reinstall the new DMG themselves
until code signing is added — auto-install won't complete on its own.

### Also fixed in the same pass: local dev/test breakage after building for distribution

`electron-builder`'s own `npmRebuild: true` step rebuilds the root
`node_modules/better-sqlite3` against **Electron's** Node ABI as a side
effect of packaging — which then breaks `npm test`/`next dev` locally
(they use the system Node's own, different ABI) until it's rebuilt back.
`electron:dev` already had a `postelectron:dev` script for this; the same
was missing for `electron:dist`/`electron:dist:publish` and has been
added (`postelectron:dist`/`postelectron:dist:publish`, both just
`npm rebuild better-sqlite3`). If tests ever fail with an
`ERR_DLOPEN_FAILED`/`NODE_MODULE_VERSION` mismatch after running a dist
build directly (bypassing npm's post-script convention, e.g. calling
`electron-builder` directly rather than via `npm run`), that's this —
run `npm rebuild better-sqlite3` to fix it.

## Local build sanity check (no publish, no GH_TOKEN)

To confirm the build chain itself works without touching GitHub:

```bash
npm run build
npm run electron:build-main
npx electron-builder --dir --publish never
```

Produces an unpacked app at `dist-installer/mac-arm64/Seos.app` (or the
equivalent for your OS) you can inspect without creating a release.
