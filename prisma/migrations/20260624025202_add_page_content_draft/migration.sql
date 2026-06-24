-- CreateTable
CREATE TABLE "page_content_drafts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "pageUrl" TEXT NOT NULL,
    "suggestedTitle" TEXT NOT NULL,
    "suggestedMetaDescription" TEXT NOT NULL,
    "bodySections" JSONB NOT NULL DEFAULT [],
    "faqs" JSONB NOT NULL DEFAULT [],
    "generatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "page_content_drafts_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "page_content_drafts_projectId_idx" ON "page_content_drafts"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "page_content_drafts_projectId_pageUrl_key" ON "page_content_drafts"("projectId", "pageUrl");
