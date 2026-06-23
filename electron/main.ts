import { app, BrowserWindow, shell, safeStorage } from "electron";
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

app.whenReady().then(async () => {
  try {
    await startNextServer();
    createWindow();
    autoUpdater.checkForUpdatesAndNotify().catch((error) => log.error("Auto-update check failed", error));
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
