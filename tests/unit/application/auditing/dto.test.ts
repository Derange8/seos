import { describe, expect, it } from "vitest";
import { toAuditRunDto } from "@/application/auditing/dto";
import { AuditRun } from "@/domain/auditing/entities/audit-run";
import { AuditIssue } from "@/domain/auditing/entities/audit-issue";
import { FixCandidate } from "@/domain/fixes/entities/fix-candidate";
import { PagePerformance } from "@/domain/tracking/entities/page-performance";

describe("toAuditRunDto", () => {
  it("attaches a priority to every issue and orders them best-to-act-on-first", () => {
    const auditRun = AuditRun.create("project-1", "job-1");
    const lowPriority = AuditIssue.create(auditRun.id, "page-1", {
      ruleId: "thin-content",
      category: "content",
      severity: "INFO",
      message: "thin",
    });
    const quickWin = AuditIssue.create(auditRun.id, "page-1", {
      ruleId: "missing-title",
      category: "technical",
      severity: "CRITICAL",
      message: "no title",
    });
    auditRun.addIssue(lowPriority);
    auditRun.addIssue(quickWin);
    auditRun.finish(1);

    const fixCandidate = FixCandidate.createRuleBased(quickWin.id, "page-1", "TITLE", "A Title");
    const dto = toAuditRunDto(auditRun, [fixCandidate]);

    expect(dto.issues.map((issue) => issue.id)).toEqual([quickWin.id, lowPriority.id]);
    expect(dto.issues[0]?.priority).toEqual({
      tier: "QUICK_WIN",
      impactScore: 10,
      hasReadyFix: true,
      estimatedFixTime: "ONE_MINUTE",
    });
    expect(dto.issues[1]?.priority).toEqual({
      tier: "LOW_PRIORITY",
      impactScore: 1,
      hasReadyFix: false,
      estimatedFixTime: "FIFTEEN_MINUTES_PLUS",
    });
  });

  it("defaults every issue to no ready fix when fixCandidates is omitted", () => {
    const auditRun = AuditRun.create("project-1", "job-1");
    const issue = AuditIssue.create(auditRun.id, "page-1", {
      ruleId: "missing-title",
      category: "technical",
      severity: "CRITICAL",
      message: "no title",
    });
    auditRun.addIssue(issue);
    auditRun.finish(1);

    const dto = toAuditRunDto(auditRun);

    expect(dto.issues[0]?.priority).toEqual({
      tier: "MANUAL_REVIEW",
      impactScore: 10,
      hasReadyFix: false,
      estimatedFixTime: "FIVE_MINUTES",
    });
  });

  it("ranks trafficImpact by real page traffic when pages/pagePerformance are supplied", () => {
    const auditRun = AuditRun.create("project-1", "job-1");
    const onPopularPage = AuditIssue.create(auditRun.id, "page-popular", {
      ruleId: "missing-title",
      category: "technical",
      severity: "WARNING",
      message: "no title",
    });
    const onQuietPage = AuditIssue.create(auditRun.id, "page-quiet", {
      ruleId: "missing-title",
      category: "technical",
      severity: "WARNING",
      message: "no title",
    });
    auditRun.addIssue(onQuietPage);
    auditRun.addIssue(onPopularPage);
    auditRun.finish(1);

    const pageUrlsByPageId = new Map([
      ["page-popular", "https://example.com/popular"],
      ["page-quiet", "https://example.com/quiet"],
    ]);
    const pagePerformance = [PagePerformance.create("project-1", "https://example.com/popular", 50, 1000, 0.05, 8)];

    const dto = toAuditRunDto(auditRun, [], pageUrlsByPageId, pagePerformance);

    const popular = dto.issues.find((i) => i.id === onPopularPage.id);
    const quiet = dto.issues.find((i) => i.id === onQuietPage.id);
    expect(popular?.trafficImpact).toEqual({ tier: "P1", pageImpressions: 1000, pageClicks: 50, hasTrafficData: true });
    expect(quiet?.trafficImpact).toEqual({ tier: "P3", pageImpressions: 0, pageClicks: 0, hasTrafficData: false });
  });

  it("attaches pageUrl and a shared routeTemplate to issues on same-shaped page URLs", () => {
    const auditRun = AuditRun.create("project-1", "job-1");
    const post1 = AuditIssue.create(auditRun.id, "page-post-1", {
      ruleId: "thin-content",
      category: "content",
      severity: "WARNING",
      message: "thin",
    });
    const post2 = AuditIssue.create(auditRun.id, "page-post-2", {
      ruleId: "thin-content",
      category: "content",
      severity: "WARNING",
      message: "thin",
    });
    auditRun.addIssue(post1);
    auditRun.addIssue(post2);
    auditRun.finish(2);

    const pageUrlsByPageId = new Map([
      ["page-post-1", "https://example.com/post/1"],
      ["page-post-2", "https://example.com/post/2"],
    ]);

    const dto = toAuditRunDto(auditRun, [], pageUrlsByPageId);

    const dto1 = dto.issues.find((issue) => issue.id === post1.id);
    const dto2 = dto.issues.find((issue) => issue.id === post2.id);
    expect(dto1?.pageUrl).toBe("https://example.com/post/1");
    expect(dto1?.routeTemplate).toBe("/post/[id]");
    expect(dto2?.routeTemplate).toBe("/post/[id]");
  });

  it("defaults pageUrl/routeTemplate to null when no page URL map is supplied", () => {
    const auditRun = AuditRun.create("project-1", "job-1");
    const issue = AuditIssue.create(auditRun.id, "page-1", {
      ruleId: "missing-title",
      category: "technical",
      severity: "CRITICAL",
      message: "no title",
    });
    auditRun.addIssue(issue);
    auditRun.finish(1);

    const dto = toAuditRunDto(auditRun);

    expect(dto.issues[0]?.pageUrl).toBeNull();
    expect(dto.issues[0]?.routeTemplate).toBeNull();
  });

  it("defaults trafficImpact to severity-only ranking with hasTrafficData false when no traffic data is supplied", () => {
    const auditRun = AuditRun.create("project-1", "job-1");
    const issue = AuditIssue.create(auditRun.id, "page-1", {
      ruleId: "missing-title",
      category: "technical",
      severity: "CRITICAL",
      message: "no title",
    });
    auditRun.addIssue(issue);
    auditRun.finish(1);

    const dto = toAuditRunDto(auditRun);

    expect(dto.issues[0]?.trafficImpact).toEqual({
      tier: "P1",
      pageImpressions: 0,
      pageClicks: 0,
      hasTrafficData: false,
    });
  });
});
