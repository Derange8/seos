-- CreateTable
CREATE TABLE "growth_analyses" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "businessUnderstanding" TEXT NOT NULL,
    "contentGapsSummary" TEXT NOT NULL,
    "opportunities" JSONB NOT NULL DEFAULT [],
    "conversionOpportunities" JSONB NOT NULL DEFAULT [],
    "missingCompetitorPages" JSONB NOT NULL DEFAULT [],
    "topPages" JSONB NOT NULL DEFAULT [],
    "executiveSummary" TEXT NOT NULL,
    "generatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "growth_analyses_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "growth_analyses_projectId_key" ON "growth_analyses"("projectId");
