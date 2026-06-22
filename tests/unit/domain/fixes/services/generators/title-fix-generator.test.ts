import { describe, expect, it } from "vitest";
import { titleFixGenerator } from "@/domain/fixes/services/generators/title-fix-generator";
import { AuditIssue } from "@/domain/auditing/entities/audit-issue";
import { Page } from "@/domain/crawling/entities/page";
import { Url } from "@/domain/crawling/value-objects/url";

function url(input: string): Url {
  const result = Url.create(input);
  if (!result.ok) throw new Error("expected ok result");
  return result.value;
}

function issue(ruleId: string): AuditIssue {
  return AuditIssue.create("run-1", "page-1", {
    ruleId,
    category: "technical",
    severity: "CRITICAL",
    message: "msg",
  });
}

describe("titleFixGenerator", () => {
  it("uses the page's H1 as the base when present", () => {
    const page = Page.create("job-1", url("https://example.com/about"), { h1: "About Our Company" });
    const candidate = titleFixGenerator.generate(page, issue("missing-title"));
    expect(candidate?.content).toContain("About Our Company");
    expect(candidate?.type).toBe("TITLE");
  });

  it("falls back to a humanized URL slug when there is no H1", () => {
    const page = Page.create("job-1", url("https://example.com/our-services"));
    const candidate = titleFixGenerator.generate(page, issue("missing-title"));
    expect(candidate?.content).toContain("Our Services");
  });

  it("pads a too-short candidate with the hostname to reach the minimum length", () => {
    const page = Page.create("job-1", url("https://example.com/faq"), { h1: "Frequently Asked Questions" });
    const candidate = titleFixGenerator.generate(page, issue("title-length"));
    expect(candidate?.content.length).toBeGreaterThanOrEqual(30);
    expect(candidate?.content).toContain("example.com");
  });

  it("pads as much as it can without guaranteeing the minimum for a pathologically short base", () => {
    // "FAQ | example.com" is still under 30 chars — there's no more real
    // signal to add without fabricating content, so the generator returns
    // its best honest attempt rather than padding with filler text.
    const page = Page.create("job-1", url("https://example.com/faq"), { h1: "FAQ" });
    const candidate = titleFixGenerator.generate(page, issue("title-length"));
    expect(candidate?.content).toBe("FAQ | example.com");
  });

  it("truncates a too-long candidate at a word boundary to stay within the maximum length", () => {
    const longH1 = "This Is An Extremely Long Heading That Goes On And On And On And On Forever";
    const page = Page.create("job-1", url("https://example.com/long"), { h1: longH1 });
    const candidate = titleFixGenerator.generate(page, issue("title-length"));
    expect(candidate?.content.length).toBeLessThanOrEqual(60);
    expect(candidate?.content.endsWith(" ")).toBe(false);
  });
});
