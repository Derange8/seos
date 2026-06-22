import { describe, expect, it } from "vitest";
import { Link } from "@/domain/crawling/entities/link";
import { Url } from "@/domain/crawling/value-objects/url";
import { isOk } from "@/shared/result";

function url(input: string): Url {
  const result = Url.create(input);
  if (!isOk(result)) throw new Error("expected ok result");
  return result.value;
}

describe("Link", () => {
  it("marks a link as internal when it shares the source origin", () => {
    const link = Link.create("page-1", url("https://example.com/"), url("https://example.com/about"));
    expect(link.isInternal).toBe(true);
  });

  it("marks a link as external when origins differ", () => {
    const link = Link.create("page-1", url("https://example.com/"), url("https://other.com/about"));
    expect(link.isInternal).toBe(false);
  });

  it("starts as not broken and can be marked broken", () => {
    const link = Link.create("page-1", url("https://example.com/"), url("https://example.com/dead"));
    expect(link.isBroken).toBe(false);
    link.markBroken();
    expect(link.isBroken).toBe(true);
  });

  it("generates a unique id per link", () => {
    const a = Link.create("page-1", url("https://example.com/"), url("https://example.com/a"));
    const b = Link.create("page-1", url("https://example.com/"), url("https://example.com/b"));
    expect(a.id).not.toBe(b.id);
  });
});
