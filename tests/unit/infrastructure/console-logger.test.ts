import { afterEach, describe, expect, it, vi } from "vitest";
import { ConsoleLogger } from "@/infrastructure/logging/console-logger";

describe("ConsoleLogger", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each(["debug", "info", "warn", "error"] as const)(
    "%s() forwards the message and context to console.%s",
    (level) => {
      const spy = vi.spyOn(console, level).mockImplementation(() => {});
      const logger = new ConsoleLogger();

      logger[level]("hello", { foo: "bar" });

      expect(spy).toHaveBeenCalledWith("hello", { foo: "bar" });
    }
  );

  it("passes an empty string when no context is given", () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => {});
    new ConsoleLogger().info("hello");
    expect(spy).toHaveBeenCalledWith("hello", "");
  });
});
