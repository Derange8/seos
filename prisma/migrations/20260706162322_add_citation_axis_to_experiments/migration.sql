-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_visibility_experiments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "baselineSlot" TEXT NOT NULL,
    "baselineRunAt" DATETIME NOT NULL,
    "baselineGrounded" BOOLEAN NOT NULL DEFAULT false,
    "baselineCited" BOOLEAN NOT NULL DEFAULT false,
    "actionAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "outcomeSlot" TEXT,
    "outcomeRunAt" DATETIME,
    "outcomeGrounded" BOOLEAN,
    "outcomeCited" BOOLEAN,
    CONSTRAINT "visibility_experiments_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_visibility_experiments" ("actionAt", "baselineRunAt", "baselineSlot", "id", "outcomeRunAt", "outcomeSlot", "projectId", "query", "status") SELECT "actionAt", "baselineRunAt", "baselineSlot", "id", "outcomeRunAt", "outcomeSlot", "projectId", "query", "status" FROM "visibility_experiments";
DROP TABLE "visibility_experiments";
ALTER TABLE "new_visibility_experiments" RENAME TO "visibility_experiments";
CREATE INDEX "visibility_experiments_projectId_idx" ON "visibility_experiments"("projectId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
