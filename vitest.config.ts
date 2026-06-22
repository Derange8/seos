import "dotenv/config";
import { defineConfig } from "vitest/config";

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
  },
});
