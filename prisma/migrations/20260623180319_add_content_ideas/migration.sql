-- CreateTable
CREATE TABLE "content_ideas" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "sourcePageUrl" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "suggestedTitle" TEXT NOT NULL,
    "suggestedSlug" TEXT NOT NULL,
    "rationale" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "content_ideas_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "content_ideas_projectId_idx" ON "content_ideas"("projectId");
