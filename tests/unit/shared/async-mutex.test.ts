import { describe, expect, it } from "vitest";
import { AsyncMutex } from "@/shared/async-mutex";

describe("AsyncMutex", () => {
  it("runs concurrent callers exclusively, one at a time in call order", async () => {
    const mutex = new AsyncMutex();
    const order: string[] = [];

    async function task(name: string, delayMs: number) {
      return mutex.runExclusive(async () => {
        order.push(`${name}:start`);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        order.push(`${name}:end`);
      });
    }

    await Promise.all([task("a", 20), task("b", 5), task("c", 0)]);

    // If they truly ran exclusively, each start/end pair is adjacent — no
    // interleaving like "a:start", "b:start", "a:end" is possible even
    // though b/c have shorter delays than a.
    expect(order).toEqual(["a:start", "a:end", "b:start", "b:end", "c:start", "c:end"]);
  });

  it("resolves with the wrapped function's return value", async () => {
    const mutex = new AsyncMutex();
    const result = await mutex.runExclusive(async () => 42);
    expect(result).toBe(42);
  });

  it("releases the lock for the next caller even if a call throws", async () => {
    const mutex = new AsyncMutex();

    await expect(
      mutex.runExclusive(async () => {
        throw new Error("boom");
      })
    ).rejects.toThrow("boom");

    // Would hang (test timeout) if the failed call above never released.
    const result = await mutex.runExclusive(async () => "recovered");
    expect(result).toBe("recovered");
  });
});
