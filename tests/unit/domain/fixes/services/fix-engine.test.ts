import { describe, expect, it } from "vitest";
import { generateFixCandidates } from "@/domain/fixes/services/fix-engine";
import { AuditIssue } from "@/domain/auditing/entities/audit-issue";
import { Page } from "@/domain/crawling/entities/page";
import { Url } from "@/domain/crawling/value-objects/url";

function url(input: string): Url {
  const result = Url.create(input);
  if (!result.ok) throw new Error("expected ok result");
  return result.value;
}

describe("generateFixCandidates", () => {
  it("produces a fix candidate for an issue with a matching generator", () => {
    const page = Page.create("job-1", url("https://example.com/"));
    const issue = AuditIssue.create("run-1", page.id, {
      ruleId: "missing-title",
      category: "technical",
      severity: "CRITICAL",
      message: "msg",
    });

    const candidates = generateFixCandidates([issue], new Map([[page.id, page]]));

    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.type).toBe("TITLE");
    expect(candidates[0]?.auditIssueId).toBe(issue.id);
  });

  it("produces nothing for an issue with no matching generator (e.g. thin-content)", () => {
    const page = Page.create("job-1", url("https://example.com/"));
    const issue = AuditIssue.create("run-1", page.id, {
      ruleId: "thin-content",
      category: "content",
      severity: "WARNING",
      message: "msg",
    });

    const candidates = generateFixCandidates([issue], new Map([[page.id, page]]));

    expect(candidates).toHaveLength(0);
  });

  it("skips an issue whose page is missing from the map", () => {
    const issue = AuditIssue.create("run-1", "unknown-page", {
      ruleId: "missing-title",
      category: "technical",
      severity: "CRITICAL",
      message: "msg",
    });

    const candidates = generateFixCandidates([issue], new Map());

    expect(candidates).toHaveLength(0);
  });

  it("produces one candidate per generatable issue across multiple pages", () => {
    const pageA = Page.create("job-1", url("https://example.com/a"));
    const pageB = Page.create("job-1", url("https://example.com/b"));
    const issues = [
      AuditIssue.create("run-1", pageA.id, {
        ruleId: "missing-title",
        category: "technical",
        severity: "CRITICAL",
        message: "msg",
      }),
      AuditIssue.create("run-1", pageB.id, {
        ruleId: "missing-canonical",
        category: "technical",
        severity: "INFO",
        message: "msg",
      }),
    ];

    const candidates = generateFixCandidates(
      issues,
      new Map([
        [pageA.id, pageA],
        [pageB.id, pageB],
      ])
    );

    expect(candidates.map((c) => c.type).sort()).toEqual(["CANONICAL_URL", "TITLE"]);
  });
});
