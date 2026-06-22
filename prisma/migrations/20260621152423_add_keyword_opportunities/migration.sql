-- CreateTable
CREATE TABLE "keyword_opportunities" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "pageUrl" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "clicks" INTEGER NOT NULL,
    "impressions" INTEGER NOT NULL,
    "ctr" REAL NOT NULL,
    "position" REAL NOT NULL,
    "fetchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "keyword_opportunities_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "keyword_opportunities_projectId_idx" ON "keyword_opportunities"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "keyword_opportunities_projectId_pageUrl_query_key" ON "keyword_opportunities"("projectId", "pageUrl", "query");
