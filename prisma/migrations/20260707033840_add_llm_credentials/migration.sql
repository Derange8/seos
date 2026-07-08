-- CreateTable
CREATE TABLE "llm_credentials" (
    "provider" TEXT NOT NULL PRIMARY KEY,
    "encryptedApiKey" TEXT NOT NULL,
    "model" TEXT,
    "updatedAt" DATETIME NOT NULL
);
