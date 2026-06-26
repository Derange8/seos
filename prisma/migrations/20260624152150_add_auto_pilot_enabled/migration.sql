-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_projects" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "verificationToken" TEXT NOT NULL,
    "domainVerifiedAt" DATETIME,
    "autoPilotEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_projects" ("createdAt", "domain", "domainVerifiedAt", "id", "name", "verificationToken") SELECT "createdAt", "domain", "domainVerifiedAt", "id", "name", "verificationToken" FROM "projects";
DROP TABLE "projects";
ALTER TABLE "new_projects" RENAME TO "projects";
CREATE UNIQUE INDEX "projects_domain_key" ON "projects"("domain");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
