import path from "node:path";
import "dotenv/config";
import { defineConfig } from "vitest/config";

// Deliberately overrides whatever DATABASE_URL is in .env (that's
// prisma/dev.db, the same file `npm run dev` reads/writes) — integration
// tests get their own file, see tests/global-setup.ts for why.
const TEST_DATABASE_URL = `file:${path.join(__dirname, "prisma/test.db")}`;

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],
    // Integration tests share one Postgres connection (the Prisma client
    // singleton); the lightweight local "prisma dev" engine trips a
    // prepared-statement protocol error under concurrent test files.
    fileParallelism: false,
    env: { DATABASE_URL: TEST_DATABASE_URL },
    globalSetup: ["./tests/global-setup.ts"],
  },
});
