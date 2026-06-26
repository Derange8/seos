-- CreateTable
CREATE TABLE "ctr_underperformers" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "pageUrl" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "position" REAL NOT NULL,
    "ctr" REAL NOT NULL,
    "expectedCtr" REAL NOT NULL,
    "clicks" INTEGER NOT NULL,
    "impressions" INTEGER NOT NULL,
    "detectedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ctr_underperformers_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ctr_underperformers_projectId_idx" ON "ctr_underperformers"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "ctr_underperformers_projectId_pageUrl_query_key" ON "ctr_underperformers"("projectId", "pageUrl", "query");
