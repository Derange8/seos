import { describe, expect, it } from "vitest";
import { h1FixGenerator } from "@/domain/fixes/services/generators/h1-fix-generator";
import { AuditIssue } from "@/domain/auditing/entities/audit-issue";
import { Page } from "@/domain/crawling/entities/page";
import { Url } from "@/domain/crawling/value-objects/url";

function url(input: string): Url {
  const result = Url.create(input);
  if (!result.ok) throw new Error("expected ok result");
  return result.value;
}

function issue(): AuditIssue {
  return AuditIssue.create("run-1", "page-1", {
    ruleId: "missing-h1",
    category: "content",
    severity: "WARNING",
    message: "msg",
  });
}

describe("h1FixGenerator", () => {
  it("uses the page's title when present", () => {
    const page = Page.create("job-1", url("https://example.com/about"), { title: "About Us — Example" });
    const candidate = h1FixGenerator.generate(page, issue());
    expect(candidate?.content).toBe("About Us — Example");
    expect(candidate?.type).toBe("H1");
  });

  it("falls back to a humanized URL slug when there is no title", () => {
    const page = Page.create("job-1", url("https://example.com/our-team"));
    const candidate = h1FixGenerator.generate(page, issue());
    expect(candidate?.content).toBe("Our Team");
  });
});
