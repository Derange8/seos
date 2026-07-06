-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ai_visibility_probe_runs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "samplesPerQuery" INTEGER NOT NULL,
    "groundingMode" TEXT NOT NULL DEFAULT 'parametric',
    "engine" TEXT NOT NULL DEFAULT 'openai',
    "outcomes" JSONB NOT NULL,
    "runAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ai_visibility_probe_runs_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ai_visibility_probe_runs" ("groundingMode", "id", "outcomes", "projectId", "runAt", "samplesPerQuery") SELECT "groundingMode", "id", "outcomes", "projectId", "runAt", "samplesPerQuery" FROM "ai_visibility_probe_runs";
DROP TABLE "ai_visibility_probe_runs";
ALTER TABLE "new_ai_visibility_probe_runs" RENAME TO "ai_visibility_probe_runs";
CREATE INDEX "ai_visibility_probe_runs_projectId_idx" ON "ai_visibility_probe_runs"("projectId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
