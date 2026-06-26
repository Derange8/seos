import fs from "node:fs";
import path from "node:path";
import { runMigrations } from "../src/infrastructure/persistence/run-migrations";

// Integration tests previously ran straight against prisma/dev.db (the same
// file `npm run dev` uses) — they shared its singleton LlmSettings/WordPress
// rows, so every test run could silently overwrite or delete a real saved
// API key. This gives the suite its own throwaway file, wiped before every
// run, so test data can never touch real local data.
const TEST_DB_PATH = path.join(__dirname, "../prisma/test.db");
const MIGRATIONS_DIR = path.join(__dirname, "../prisma/migrations");

export function setup(): void {
  fs.rmSync(TEST_DB_PATH, { force: true });
  fs.rmSync(`${TEST_DB_PATH}-journal`, { force: true });
  runMigrations(TEST_DB_PATH, MIGRATIONS_DIR);
}
