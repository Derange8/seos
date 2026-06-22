import { describe, expect, it } from "vitest";
import { brokenInternalLinksRule } from "@/domain/auditing/services/rules/broken-internal-links-rule";
import { Page } from "@/domain/crawling/entities/page";
import { Link } from "@/domain/crawling/entities/link";
import { Url } from "@/domain/crawling/value-objects/url";

function url(input: string): Url {
  const result = Url.create(input);
  if (!result.ok) throw new Error("expected ok result");
  return result.value;
}

describe("brokenInternalLinksRule", () => {
  it("flags a page that links to a broken internal page", () => {
    const page = Page.create("job-1", url("https://example.com/"));
    const link = Link.create(page.id, page.url, url("https://example.com/missing"));
    link.markBroken();
    page.addLink(link);

    const findings = brokenInternalLinksRule.evaluate(page);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.category).toBe("technical");
    expect(findings[0]?.severity).toBe("WARNING");
    expect(findings[0]?.message).toContain("1");
  });

  it("does not flag a page whose links are all healthy", () => {
    const page = Page.create("job-1", url("https://example.com/"));
    page.addLink(Link.create(page.id, page.url, url("https://example.com/about")));

    expect(brokenInternalLinksRule.evaluate(page)).toHaveLength(0);
  });

  it("ignores broken external links", () => {
    const page = Page.create("job-1", url("https://example.com/"));
    const link = Link.create(page.id, page.url, url("https://other.example.com/missing"));
    link.markBroken();
    page.addLink(link);

    expect(brokenInternalLinksRule.evaluate(page)).toHaveLength(0);
  });
});
