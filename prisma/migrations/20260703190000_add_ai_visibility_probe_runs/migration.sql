-- CreateTable
CREATE TABLE "ai_visibility_probe_runs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "samplesPerQuery" INTEGER NOT NULL,
    "outcomes" JSONB NOT NULL,
    "runAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ai_visibility_probe_runs_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ai_visibility_probe_runs_projectId_idx" ON "ai_visibility_probe_runs"("projectId");
