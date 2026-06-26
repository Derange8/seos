-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_pages" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "crawlJobId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "statusCode" INTEGER,
    "title" TEXT,
    "metaDescription" TEXT,
    "h1" TEXT,
    "canonicalUrl" TEXT,
    "contentHash" TEXT,
    "wordCount" INTEGER,
    "contentExcerpt" TEXT,
    "faqs" JSONB NOT NULL DEFAULT '[]',
    "responseTimeMs" INTEGER,
    "hasStructuredData" BOOLEAN NOT NULL DEFAULT false,
    "imagesMissingAltCount" INTEGER NOT NULL DEFAULT 0,
    "redirectChain" JSONB NOT NULL DEFAULT '[]',
    "mixedContentCount" INTEGER NOT NULL DEFAULT 0,
    "hasDuplicateTitle" BOOLEAN NOT NULL DEFAULT false,
    "hasDuplicateMetaDescription" BOOLEAN NOT NULL DEFAULT false,
    "hasDuplicateContent" BOOLEAN NOT NULL DEFAULT false,
    "h1Count" INTEGER NOT NULL DEFAULT 0,
    "canonicalTagCount" INTEGER NOT NULL DEFAULT 0,
    "isNoindex" BOOLEAN NOT NULL DEFAULT false,
    "isOrphan" BOOLEAN NOT NULL DEFAULT false,
    "cspHeader" TEXT,
    "externalScriptOrigins" JSONB NOT NULL DEFAULT '[]',
    "crawledAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "pages_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "pages_crawlJobId_fkey" FOREIGN KEY ("crawlJobId") REFERENCES "crawl_jobs" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_pages" ("canonicalTagCount", "canonicalUrl", "contentExcerpt", "contentHash", "crawlJobId", "crawledAt", "faqs", "h1", "h1Count", "hasDuplicateContent", "hasDuplicateMetaDescription", "hasDuplicateTitle", "hasStructuredData", "id", "imagesMissingAltCount", "isNoindex", "isOrphan", "metaDescription", "mixedContentCount", "projectId", "redirectChain", "responseTimeMs", "statusCode", "title", "url", "wordCount") SELECT "canonicalTagCount", "canonicalUrl", "contentExcerpt", "contentHash", "crawlJobId", "crawledAt", "faqs", "h1", "h1Count", "hasDuplicateContent", "hasDuplicateMetaDescription", "hasDuplicateTitle", "hasStructuredData", "id", "imagesMissingAltCount", "isNoindex", "isOrphan", "metaDescription", "mixedContentCount", "projectId", "redirectChain", "responseTimeMs", "statusCode", "title", "url", "wordCount" FROM "pages";
DROP TABLE "pages";
ALTER TABLE "new_pages" RENAME TO "pages";
CREATE INDEX "pages_projectId_idx" ON "pages"("projectId");
CREATE UNIQUE INDEX "pages_crawlJobId_url_key" ON "pages"("crawlJobId", "url");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
