import { describe, expect, it } from "vitest";
import { RunAuditUseCase } from "@/application/auditing/use-cases/run-audit-use-case";
import { Page } from "@/domain/crawling/entities/page";
import { Url } from "@/domain/crawling/value-objects/url";
import type { AuditRule } from "@/domain/auditing/services/audit-rule";
import { AuditRunCompleted } from "@/domain/auditing/events/audit-run-completed";
import { DomainEventDispatcher } from "@/shared/domain-event-dispatcher";
import { FakeAuditRunRepository } from "./fakes";
import { FakePageRepository } from "../crawling/fakes";

function url(input: string): Url {
  const result = Url.create(input);
  if (!result.ok) throw new Error("expected ok result");
  return result.value;
}

describe("RunAuditUseCase", () => {
  it("produces a perfect score for a clean crawl job", async () => {
    const pageRepository = new FakePageRepository();
    await pageRepository.save(
      "project-1",
      Page.create("job-1", url("https://example.com/"), {
        title: "A Perfectly Sized Title For This Page",
        metaDescription:
          "A meta description that comfortably sits within the recommended length range for search engines.",
        h1: "Welcome",
        canonicalUrl: "https://example.com/",
        statusCode: 200,
        wordCount: 500,
        responseTimeMs: 200,
        hasStructuredData: true,
      })
    );

    const auditRunRepository = new FakeAuditRunRepository();
    const useCase = new RunAuditUseCase({ pageRepository, auditRunRepository });

    const auditRun = await useCase.execute("project-1", "job-1");

    expect(auditRun.issues).toHaveLength(0);
    expect(auditRun.overallScore).toBe(100);
    expect(auditRun.isFinished).toBe(true);
    expect(auditRunRepository.saved).toHaveLength(1);
  });

  it("collects issues from every rule that fires across all pages", async () => {
    const pageRepository = new FakePageRepository();
    await pageRepository.save(
      "project-1",
      Page.create("job-1", url("https://example.com/a"), { title: null, statusCode: 200 })
    );
    await pageRepository.save(
      "project-1",
      Page.create("job-1", url("https://example.com/b"), { statusCode: 404 })
    );

    const auditRunRepository = new FakeAuditRunRepository();
    const useCase = new RunAuditUseCase({ pageRepository, auditRunRepository });

    const auditRun = await useCase.execute("project-1", "job-1");

    const ruleIds = auditRun.issues.map((issue) => issue.ruleId);
    expect(ruleIds).toContain("missing-title");
    expect(ruleIds).toContain("broken-status-code");
    expect(auditRun.overallScore).toBeLessThan(100);
  });

  it("skips content-quality rules for a broken (4xx/5xx) page, but still reports broken-status-code", async () => {
    const pageRepository = new FakePageRepository();
    await pageRepository.save(
      "project-1",
      Page.create("job-1", url("https://example.com/missing"), { title: null, statusCode: 404 })
    );

    const auditRunRepository = new FakeAuditRunRepository();
    const useCase = new RunAuditUseCase({ pageRepository, auditRunRepository });

    const auditRun = await useCase.execute("project-1", "job-1");

    const ruleIds = auditRun.issues.map((issue) => issue.ruleId);
    expect(ruleIds).toEqual(["broken-status-code"]);
  });

  it("skips content-quality rules for a noindex page, but still reports noindex/technical findings", async () => {
    const pageRepository = new FakePageRepository();
    await pageRepository.save(
      "project-1",
      Page.create("job-1", url("https://example.com/dashboard"), {
        title: null,
        statusCode: 200,
        wordCount: 5,
        isNoindex: true,
        mixedContentCount: 1,
      })
    );

    const auditRunRepository = new FakeAuditRunRepository();
    const useCase = new RunAuditUseCase({ pageRepository, auditRunRepository });

    const auditRun = await useCase.execute("project-1", "job-1");

    const ruleIds = auditRun.issues.map((issue) => issue.ruleId);
    expect(ruleIds).toContain("noindex");
    expect(ruleIds).toContain("mixed-content");
    expect(ruleIds).not.toContain("missing-title");
    expect(ruleIds).not.toContain("thin-content");
  });

  it("skips HTML-only rules for a non-HTML resource (e.g. a PDF), but still reports format-agnostic findings", async () => {
    const pageRepository = new FakePageRepository();
    await pageRepository.save(
      "project-1",
      Page.create("job-1", url("https://example.com/brochure.pdf"), {
        title: null,
        statusCode: 200,
        responseTimeMs: 20_000,
        contentType: "application/pdf",
      })
    );

    const auditRunRepository = new FakeAuditRunRepository();
    const useCase = new RunAuditUseCase({ pageRepository, auditRunRepository });

    const auditRun = await useCase.execute("project-1", "job-1");

    const ruleIds = auditRun.issues.map((issue) => issue.ruleId);
    expect(ruleIds).not.toContain("missing-title");
    expect(ruleIds).not.toContain("thin-content");
    expect(ruleIds).toContain("slow-response-time");
  });

  it("still runs HTML-only rules for a page with no contentType recorded (null treated as HTML)", async () => {
    const pageRepository = new FakePageRepository();
    await pageRepository.save(
      "project-1",
      Page.create("job-1", url("https://example.com/legacy"), { title: null, statusCode: 200, contentType: null })
    );

    const auditRunRepository = new FakeAuditRunRepository();
    const useCase = new RunAuditUseCase({ pageRepository, auditRunRepository });

    const auditRun = await useCase.execute("project-1", "job-1");

    expect(auditRun.issues.map((issue) => issue.ruleId)).toContain("missing-title");
  });

  it("still runs rules normally for a page with no statusCode recorded yet (null, not a known failure)", async () => {
    const pageRepository = new FakePageRepository();
    await pageRepository.save(
      "project-1",
      Page.create("job-1", url("https://example.com/unknown-status"), { title: null })
    );

    const auditRunRepository = new FakeAuditRunRepository();
    const useCase = new RunAuditUseCase({ pageRepository, auditRunRepository });

    const auditRun = await useCase.execute("project-1", "job-1");

    expect(auditRun.issues.map((issue) => issue.ruleId)).toContain("missing-title");
  });

  it("handles a crawl job with zero pages without error", async () => {
    const pageRepository = new FakePageRepository();
    const auditRunRepository = new FakeAuditRunRepository();
    const useCase = new RunAuditUseCase({ pageRepository, auditRunRepository });

    const auditRun = await useCase.execute("project-1", "job-empty");

    expect(auditRun.issues).toHaveLength(0);
    expect(auditRun.overallScore).toBe(100);
  });

  it("supports overriding the rule set", async () => {
    const pageRepository = new FakePageRepository();
    await pageRepository.save("project-1", Page.create("job-1", url("https://example.com/")));

    const customRule: AuditRule = {
      id: "always-fires",
      evaluate: () => [
        { ruleId: "always-fires", category: "technical", severity: "INFO", message: "always" },
      ],
    };

    const auditRunRepository = new FakeAuditRunRepository();
    const useCase = new RunAuditUseCase({ pageRepository, auditRunRepository, rules: [customRule] });

    const auditRun = await useCase.execute("project-1", "job-1");

    expect(auditRun.issues).toHaveLength(1);
    expect(auditRun.issues[0]?.ruleId).toBe("always-fires");
  });

  it("dispatches AuditRunCompleted when an event dispatcher is supplied", async () => {
    const pageRepository = new FakePageRepository();
    await pageRepository.save("project-1", Page.create("job-1", url("https://example.com/")));

    const auditRunRepository = new FakeAuditRunRepository();
    const eventDispatcher = new DomainEventDispatcher();
    const received: AuditRunCompleted[] = [];
    eventDispatcher.on(AuditRunCompleted, async (event) => {
      received.push(event);
    });

    const useCase = new RunAuditUseCase({ pageRepository, auditRunRepository, eventDispatcher });
    const auditRun = await useCase.execute("project-1", "job-1");

    expect(received).toHaveLength(1);
    expect(received[0]?.auditRunId).toBe(auditRun.id);
    expect(received[0]?.projectId).toBe("project-1");
  });

  it("does not dispatch anything when no event dispatcher is supplied", async () => {
    const pageRepository = new FakePageRepository();
    await pageRepository.save("project-1", Page.create("job-1", url("https://example.com/")));

    const auditRunRepository = new FakeAuditRunRepository();
    const useCase = new RunAuditUseCase({ pageRepository, auditRunRepository });

    await expect(useCase.execute("project-1", "job-1")).resolves.toBeDefined();
  });
});
