import { describe, expect, it } from "vitest";
import { parseJsonFromLlm } from "@/infrastructure/llm/llm-json";

describe("parseJsonFromLlm", () => {
  it("parses plain JSON", () => {
    expect(parseJsonFromLlm('{"a":1}')).toEqual({ a: 1 });
  });

  it("strips a ```json code fence before parsing", () => {
    expect(parseJsonFromLlm('```json\n{"a":1}\n```')).toEqual({ a: 1 });
  });

  it("strips a bare ``` fence", () => {
    expect(parseJsonFromLlm('```\n[1,2]\n```')).toEqual([1, 2]);
  });

  it("throws a consistent error on invalid JSON", () => {
    expect(() => parseJsonFromLlm("not json")).toThrow(/valid JSON/);
  });
});
