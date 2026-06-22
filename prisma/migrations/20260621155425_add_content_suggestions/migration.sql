-- CreateTable
CREATE TABLE "content_suggestions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "keywordOpportunityId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "content_suggestions_keywordOpportunityId_fkey" FOREIGN KEY ("keywordOpportunityId") REFERENCES "keyword_opportunities" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "content_suggestions_keywordOpportunityId_key" ON "content_suggestions"("keywordOpportunityId");
