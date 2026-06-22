import { describe, expect, it } from "vitest";
import { err, isErr, isOk, map, mapErr, ok, unwrapOr } from "@/shared/result";

describe("Result", () => {
  it("ok() produces a successful result", () => {
    const result = ok(42);
    expect(isOk(result)).toBe(true);
    expect(isErr(result)).toBe(false);
  });

  it("err() produces a failed result", () => {
    const result = err("boom");
    expect(isErr(result)).toBe(true);
    expect(isOk(result)).toBe(false);
  });

  it("map() transforms the value of an Ok result", () => {
    const result = map(ok(2), (n) => n * 2);
    expect(isOk(result) && result.value).toBe(4);
  });

  it("map() is a no-op on an Err result", () => {
    const result = map(err<string>("boom"), (n: number) => n * 2);
    expect(isErr(result) && result.error).toBe("boom");
  });

  it("mapErr() transforms the error of an Err result", () => {
    const result = mapErr(err("boom"), (e) => `wrapped:${e}`);
    expect(isErr(result) && result.error).toBe("wrapped:boom");
  });

  it("unwrapOr() returns the value for Ok", () => {
    expect(unwrapOr(ok(5), 0)).toBe(5);
  });

  it("unwrapOr() returns the fallback for Err", () => {
    expect(unwrapOr(err("boom"), 0)).toBe(0);
  });
});
