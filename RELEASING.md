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

The network/version-detection path was verified on 2026-07-06 (see above) by
fetching the real anonymous feed URL and confirming a newer version resolves
correctly with a downloadable asset. **What's still unverified is the actual
in-app experience** — the GUI dialog appearing, the download progress, the
"restart to install" flow — because the sandboxed environment this was
checked from cannot launch a macOS GUI app (`open`/direct-exec produced no
running process or logs; not a code problem, an environment limitation).

To close that last piece on a real machine:

1. Publish a release at version `X.Y.Z` per the steps above (checking for
   the duplicate-draft bug above).
2. Install that build on a real machine.
3. Bump to `X.Y.Z+1` and publish again (same duplicate-draft check).
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
