-- CreateTable
CREATE TABLE "keyword_cannibalizations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "pages" JSONB NOT NULL,
    "detectedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "keyword_cannibalizations_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "keyword_cannibalizations_projectId_idx" ON "keyword_cannibalizations"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "keyword_cannibalizations_projectId_query_key" ON "keyword_cannibalizations"("projectId", "query");
