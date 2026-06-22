-- CreateTable
CREATE TABLE "llm_settings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'singleton',
    "provider" TEXT NOT NULL,
    "encryptedApiKey" TEXT NOT NULL,
    "model" TEXT,
    "updatedAt" DATETIME NOT NULL
);
