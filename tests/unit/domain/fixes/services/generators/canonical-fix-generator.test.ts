import { describe, expect, it } from "vitest";
import { canonicalFixGenerator } from "@/domain/fixes/services/generators/canonical-fix-generator";
import { AuditIssue } from "@/domain/auditing/entities/audit-issue";
import { Page } from "@/domain/crawling/entities/page";
import { Url } from "@/domain/crawling/value-objects/url";

function url(input: string): Url {
  const result = Url.create(input);
  if (!result.ok) throw new Error("expected ok result");
  return result.value;
}

describe("canonicalFixGenerator", () => {
  it("canonicalizes the page to its own URL", () => {
    const page = Page.create("job-1", url("https://example.com/page"));
    const issue = AuditIssue.create("run-1", page.id, {
      ruleId: "missing-canonical",
      category: "technical",
      severity: "INFO",
      message: "msg",
    });

    const candidate = canonicalFixGenerator.generate(page, issue);

    expect(candidate?.content).toBe("https://example.com/page");
    expect(candidate?.type).toBe("CANONICAL_URL");
  });
});
