import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runMigrations } from "@/infrastructure/persistence/run-migrations";

const MIGRATIONS_DIR = path.resolve(__dirname, "../../../prisma/migrations");

describe("runMigrations", () => {
  let tmpDir: string;
  let dbPath: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "seos-migrations-test-"));
    dbPath = path.join(tmpDir, "seos.db");
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("creates a usable schema from a fresh file", () => {
    runMigrations(dbPath, MIGRATIONS_DIR);

    const db = new Database(dbPath);
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
      .all()
      .map((row) => (row as { name: string }).name);
    db.close();

    expect(tables).toContain("projects");
    expect(tables).toContain("crawl_jobs");
    expect(tables).toContain("pages");
  });

  it("is idempotent — running it again does not error or duplicate work", () => {
    runMigrations(dbPath, MIGRATIONS_DIR);
    expect(() => runMigrations(dbPath, MIGRATIONS_DIR)).not.toThrow();

    const db = new Database(dbPath);
    const applied = db.prepare("SELECT name FROM _app_migrations").all();
    db.close();

    expect(applied.length).toBeGreaterThan(0);
  });

  it("creates the database file and its parent directory if missing", () => {
    const nestedPath = path.join(tmpDir, "nested", "dir", "seos.db");
    expect(fs.existsSync(nestedPath)).toBe(false);

    runMigrations(nestedPath, MIGRATIONS_DIR);

    expect(fs.existsSync(nestedPath)).toBe(true);
  });
});
