import { app, BrowserWindow, Menu, dialog, shell, safeStorage } from "electron";
import { autoUpdater } from "electron-updater";
import log from "electron-log";
import { spawn, type ChildProcess } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { runMigrations } from "../src/infrastructure/persistence/run-migrations";

const PORT = 3100;
const HOSTNAME = "127.0.0.1";
const APP_URL = `http://${HOSTNAME}:${PORT}`;

// In the packaged app, resources/ holds the standalone Next.js server and
// the migration SQL files (see electron-builder.yml's extraResources). In
// dev, app.isPackaged is false and we read straight from the repo.
const resourcesDir = app.isPackaged ? process.resourcesPath : path.join(__dirname, "..");
const standaloneDir = path.join(resourcesDir, app.isPackaged ? "standalone" : ".next/standalone");
const migrationsDir = path.join(resourcesDir, "prisma/migrations");

let serverProcess: ChildProcess | null = null;
let mainWindow: BrowserWindow | null = null;

// Generated once per install, persisted in userData — never bundled into
// the shipped app (a baked-in key would be the same for every install,
// defeating the point of encrypting credentials at rest). The on-disk file
// is itself wrapped via Electron's safeStorage (OS keychain/DPAPI/libsecret)
// rather than written as plain bytes: a flat key file sitting next to the
// SQLite db it decrypts gives an attacker with filesystem access (stolen
// disk, malware, another local account) the key for free. Wrapping it
// ties decryption to the OS's own credential store for the logged-in user,
// which a raw file copy can't satisfy on its own.
function ensureCredentialEncryptionKey(userDataDir: string): string {
  const keyPath = path.join(userDataDir, "credential-encryption.key");
  const encryptionAvailable = safeStorage.isEncryptionAvailable();

  if (fs.existsSync(keyPath)) {
    const stored = fs.readFileSync(keyPath);
    if (!encryptionAvailable) return stored.toString("utf-8").trim();
    try {
      return safeStorage.decryptString(stored);
    } catch {
      // Pre-existing install from before this file was OS-wrapped (plain
      // key bytes from an older version of Seos) — read it as-is, then
      // re-persist wrapped so this is a one-time, automatic migration.
      const legacyKey = stored.toString("utf-8").trim();
      fs.writeFileSync(keyPath, safeStorage.encryptString(legacyKey), { mode: 0o600 });
      return legacyKey;
    }
  }

  const key = crypto.randomBytes(32).toString("base64");
  const toPersist = encryptionAvailable ? safeStorage.encryptString(key) : Buffer.from(key, "utf-8");
  fs.writeFileSync(keyPath, toPersist, { mode: 0o600 });
  return key;
}

async function waitForServerReady(url: string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok || response.status < 500) return;
    } catch {
      // server not listening yet
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`Next.js server did not become ready within ${timeoutMs}ms`);
}

async function startNextServer(): Promise<void> {
  const userDataDir = app.getPath("userData");
  const dbPath = path.join(userDataDir, "seos.db");

  runMigrations(dbPath, migrationsDir);

  const env = {
    ...process.env,
    PORT: String(PORT),
    HOSTNAME,
    DATABASE_URL: `file:${dbPath}`,
    CREDENTIAL_ENCRYPTION_KEY: ensureCredentialEncryptionKey(userDataDir),
    // Without this, spawning process.execPath in a packaged app launches a
    // second full Electron/GUI process (execPath IS the Electron binary
    // once packaged, unlike in dev where it's the system node binary) —
    // it never runs server.js as a plain Node script, so the server this
    // is supposed to start never actually comes up. Confirmed via a real
    // packaged build: waitForServerReady always timed out at exactly
    // 20000ms with zero server-side logs, because nothing was ever
    // actually listening on PORT.
    ELECTRON_RUN_AS_NODE: "1",
  };

  serverProcess = spawn(process.execPath, [path.join(standaloneDir, "server.js")], {
    env,
    cwd: standaloneDir,
    stdio: "pipe",
  });

  serverProcess.stdout?.on("data", (chunk) => log.info(`[next] ${chunk.toString().trim()}`));
  serverProcess.stderr?.on("data", (chunk) => log.error(`[next] ${chunk.toString().trim()}`));

  await waitForServerReady(APP_URL, 20000);
}

// Electron only wires up standard Cmd+C/Cmd+V/Cmd+X/Cmd+A behavior for
// text fields when an app menu with an "Edit" role is actually installed.
// This app never set one, so — confirmed live — pasting into any input
// (e.g. the LLM API key field on the settings page) silently did nothing
// on macOS: Cmd+V had no menu item behind it to dispatch the paste
// command to the focused webContents. A bare "Edit" role is the standard
// fix; the rest of a typical default menu (File/View/Window) isn't needed
// for a single-window utility app, but Edit's copy/paste/undo bindings
// are load-bearing for basic form usability.
function installEditMenu(): void {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "selectAll" },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 840,
    title: "Seos",
  });
  // window.open() calls (e.g. the Google OAuth "Connect" button) must
  // open in the user's actual default browser, not a second in-app
  // BrowserWindow — the OAuth consent screen, and anything else a page
  // might link out to, belongs in the system browser.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
  mainWindow.loadURL(APP_URL);
}

// The app is unsigned (no Apple Developer ID certificate — see
// RELEASING.md), so electron-updater's normal auto-download-and-install
// flow is a dead end: macOS's native updater (Squirrel.Mac, which
// electron-updater drives on macOS) refuses to swap in a new bundle
// unless its code signature matches the old one, and an unsigned app has
// no signature to match. Confirmed live: a real install correctly found
// and downloaded a newer real release, then failed at the final "install
// it" step with a Gatekeeper signature-validation error — no code change
// upstream of that point can fix it; only a paid Developer ID cert does.
//
// Rather than let users hit that failure, this only ever asks
// electron-updater to CHECK (autoDownload: false) — it never downloads or
// attempts to install. When a newer version exists, a native dialog offers
// to open its GitHub release page in the user's normal browser, where the
// DMG is one click away and installs the ordinary drag-to-Applications
// way — no signature check applies to a fresh manual install (only to
// Squirrel.Mac's in-place swap of an already-running app), no hunting for
// a download link, no terminal.
function checkForUpdatesManually(): void {
  autoUpdater.logger = log;
  autoUpdater.autoDownload = false;

  autoUpdater.on("checking-for-update", () => log.info("Auto-update: checking for update"));
  autoUpdater.on("update-not-available", (info) => log.info("Auto-update: no update available", info));
  autoUpdater.on("error", (error) => log.error("Auto-update: error", error));

  autoUpdater.on("update-available", (info) => {
    log.info("Auto-update: update available", info);
    const releaseUrl = `https://github.com/Derange8/seos/releases/tag/v${info.version}`;
    dialog
      .showMessageBox({
        type: "info",
        title: "Update available",
        message: `Seos ${info.version} is available (you have ${app.getVersion()}).`,
        detail: "Opens the release page in your browser — download the installer and drag it into Applications as usual.",
        buttons: ["Open release page", "Later"],
        defaultId: 0,
        cancelId: 1,
      })
      .then((result) => {
        if (result.response === 0) shell.openExternal(releaseUrl);
      });
  });

  autoUpdater.checkForUpdates().catch((error) => log.error("Auto-update check failed", error));
}

app.whenReady().then(async () => {
  try {
    installEditMenu();
    await startNextServer();
    createWindow();
    checkForUpdatesManually();
  } catch (error) {
    log.error("Failed to start Seos", error);
    app.quit();
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  serverProcess?.kill();
});
