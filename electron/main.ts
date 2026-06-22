import { app, BrowserWindow, shell } from "electron";
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
// defeating the point of encrypting credentials at rest). Falls back to
// generating a fresh one if the file is ever missing/corrupt.
function ensureCredentialEncryptionKey(userDataDir: string): string {
  const keyPath = path.join(userDataDir, "credential-encryption.key");
  if (fs.existsSync(keyPath)) {
    return fs.readFileSync(keyPath, "utf-8").trim();
  }
  const key = crypto.randomBytes(32).toString("base64");
  fs.writeFileSync(keyPath, key, { mode: 0o600 });
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
