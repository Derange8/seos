-- CreateTable
CREATE TABLE "visibility_experiments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "baselineSlot" TEXT NOT NULL,
    "baselineRunAt" DATETIME NOT NULL,
    "actionAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "outcomeSlot" TEXT,
    "outcomeRunAt" DATETIME,
    CONSTRAINT "visibility_experiments_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "visibility_experiments_projectId_idx" ON "visibility_experiments"("projectId");
