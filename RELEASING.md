# Releasing a new version

Seos ships as a packaged Electron app (macOS/Windows/Linux) that checks
`Derange8/seos`'s GitHub Releases for updates on every launch
(`autoUpdater.checkForUpdatesAndNotify()` in `electron/main.ts`). This is the
step-by-step for cutting a real release — not yet exercised against a real
GitHub release as of this writing (the config below is verified: a real local
build succeeds; only the actual publish + a live update-detection round trip
are still untested).

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

Not yet done — this is the real gap. To close it before wider distribution:

1. Publish a release at version `X.Y.Z` per the steps above.
2. Install that build on a real machine (or a second user account/VM).
3. Bump to `X.Y.Z+1` and publish again.
4. Relaunch the installed `X.Y.Z` app and confirm `electron-log`'s
   `main.log` (`~/Library/Logs/Seos/main.log` on macOS) shows
   electron-updater finding, downloading, and prompting to install the new
   version — then confirm the relaunched app actually reports the new
   version.

## Local build sanity check (no publish, no GH_TOKEN)

To confirm the build chain itself works without touching GitHub:

```bash
npm run build
npm run electron:build-main
npx electron-builder --dir --publish never
```

Produces an unpacked app at `dist-installer/mac-arm64/Seos.app` (or the
equivalent for your OS) you can inspect without creating a release.
