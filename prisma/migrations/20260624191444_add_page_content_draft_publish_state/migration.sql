-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_page_content_drafts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "pageUrl" TEXT NOT NULL,
    "suggestedTitle" TEXT NOT NULL,
    "suggestedMetaDescription" TEXT NOT NULL,
    "bodySections" JSONB NOT NULL DEFAULT [],
    "faqs" JSONB NOT NULL DEFAULT [],
    "generatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "previousTitle" TEXT,
    "previousMetaDescription" TEXT,
    "previousContent" TEXT,
    CONSTRAINT "page_content_drafts_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_page_content_drafts" ("bodySections", "faqs", "generatedAt", "id", "pageUrl", "projectId", "suggestedMetaDescription", "suggestedTitle") SELECT "bodySections", "faqs", "generatedAt", "id", "pageUrl", "projectId", "suggestedMetaDescription", "suggestedTitle" FROM "page_content_drafts";
DROP TABLE "page_content_drafts";
ALTER TABLE "new_page_content_drafts" RENAME TO "page_content_drafts";
CREATE INDEX "page_content_drafts_projectId_idx" ON "page_content_drafts"("projectId");
CREATE UNIQUE INDEX "page_content_drafts_projectId_pageUrl_key" ON "page_content_drafts"("projectId", "pageUrl");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
