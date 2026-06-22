import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

// Applies prisma/migrations/*/migration.sql files directly via
// better-sqlite3, tracked in a small custom table — used by the packaged
// Electron app at startup. Deliberately not shelling out to the Prisma CLI
// (`prisma migrate deploy`): that needs the schema-engine binary bundled
// into the app just to run SQL files we already have on disk, for a
// program with exactly one local database file and no concurrent
// deployments to coordinate. `next dev`/tests use `prisma db push`
// directly instead and never call this.
export function runMigrations(databaseFilePath: string, migrationsDir: string): void {
  fs.mkdirSync(path.dirname(databaseFilePath), { recursive: true });
  const db = new Database(databaseFilePath);

  try {
    db.exec(
      `CREATE TABLE IF NOT EXISTS _app_migrations (
        name TEXT PRIMARY KEY,
        applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`
    );

    const applied = new Set(
      db.prepare("SELECT name FROM _app_migrations").all().map((row) => (row as { name: string }).name)
    );

    const migrationFolders = fs
      .readdirSync(migrationsDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();

    for (const folder of migrationFolders) {
      if (applied.has(folder)) continue;

      const sqlPath = path.join(migrationsDir, folder, "migration.sql");
      const sql = fs.readFileSync(sqlPath, "utf-8");

      db.exec("BEGIN");
      try {
        db.exec(sql);
        db.prepare("INSERT INTO _app_migrations (name) VALUES (?)").run(folder);
        db.exec("COMMIT");
      } catch (error) {
        db.exec("ROLLBACK");
        throw new Error(`Migration "${folder}" failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  } finally {
    db.close();
  }
}
