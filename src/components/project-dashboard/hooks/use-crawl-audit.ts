import { useEffect, useMemo, useRef, useState } from "react";
import type { CrawlJobDto, PageDto } from "@/application/crawling/dto";
import type { AuditIssueDto, AuditRunDto } from "@/application/auditing/dto";
import type { SitemapFileDto } from "@/application/sitemap/dto";
import type { LlmsTxtFileDto } from "@/application/llms-txt/dto";
import type { RobotsFileDto } from "@/application/robots/dto";
import type { SchemaMarkupDto } from "@/application/schema-markup/dto";
import type { SeoScoreDto } from "@/application/scoring/dto";
import type { FixCandidateDto } from "@/application/fixes/dto";
import type { AuditDeltaDto } from "@/application/delta-audit/dto";
import { type EventFailureDto, POLLABLE_STATUSES, POLL_ATTEMPTS, POLL_INTERVAL_MS, type TranslationKey } from "../shared";

export interface IssueTemplateGroup {
  routeTemplate: string;
  issues: AuditIssueDto[];
}

export interface IssueGroup {
  ruleId: string;
  issues: AuditIssueDto[];
  templateGroups: IssueTemplateGroup[];
  ungroupedIssues: AuditIssueDto[];
}

// Owns the entire crawl → audit → generated-outputs pipeline: starting a
// crawl, polling its status, and once it completes, pulling in the audit
// run, fix candidates, sitemap/robots/llms.txt/schema markup, the delta vs
// the previous run, and any background-handler failures. This is the
// largest single slice of the dashboard's state because it's genuinely one
// pipeline — a crawl finishing is what triggers everything else here.
export function useCrawlAudit(projectId: string, t: (key: TranslationKey) => string) {
  const [crawlJob, setCrawlJob] = useState<CrawlJobDto | null>(null);
  const [pages, setPages] = useState<PageDto[]>([]);
  const [isStartingCrawl, setIsStartingCrawl] = useState(false);
  const [crawlError, setCrawlError] = useState<string | null>(null);
  const [auditRun, setAuditRun] = useState<AuditRunDto | null>(null);
  const [scores, setScores] = useState<SeoScoreDto[]>([]);
  const [sitemap, setSitemap] = useState<SitemapFileDto | null>(null);
  const [showSitemapXml, setShowSitemapXml] = useState(false);
  const [llmsTxt, setLlmsTxt] = useState<LlmsTxtFileDto | null>(null);
  const [showLlmsTxt, setShowLlmsTxt] = useState(false);
  const [robots, setRobots] = useState<RobotsFileDto | null>(null);
  const [showRobotsTxt, setShowRobotsTxt] = useState(false);
  const [schemaMarkup, setSchemaMarkup] = useState<SchemaMarkupDto[]>([]);
  const [expandedSchemaId, setExpandedSchemaId] = useState<string | null>(null);
  const [fixCandidates, setFixCandidates] = useState<FixCandidateDto[]>([]);
  const [copiedFixId, setCopiedFixId] = useState<string | null>(null);
  const [copiedFullReport, setCopiedFullReport] = useState(false);
  const [delta, setDelta] = useState<AuditDeltaDto | null>(null);
  const [eventFailures, setEventFailures] = useState<EventFailureDto[]>([]);
  // Per-fix, not global — applying/reverting one fix candidate shouldn't
  // disable the buttons on every other one.
  const [fixActionPendingId, setFixActionPendingId] = useState<string | null>(null);
  const [fixActionErrors, setFixActionErrors] = useState<Record<string, string>>({});
  // Keyed by the group's ruleId (or ruleId::routeTemplate for a template
  // sub-group) — "Fix All" disables only the button for the group actually
  // being applied, not every group's button on the page.
  const [fixAllPendingKey, setFixAllPendingKey] = useState<string | null>(null);
  const [fixAllErrors, setFixAllErrors] = useState<Record<string, string>>({});
  // Which rule-id groups are expanded in the Issues tab — the same
  // underlying defect (e.g. a client-rendered page template) often fires
  // the same rule on a dozen pages, and a flat list of 184 individual
  // findings reads as 184 distinct problems rather than ~10 real ones.
  // Groups with only one affected page render without a toggle at all.
  const [expandedRuleIds, setExpandedRuleIds] = useState<Set<string>>(new Set());

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  // Unlike the audit run and sitemap, robots.txt has no dependency on a
  // crawl having run at all — it's derived purely from the project's
  // domain — so it's fetched (and generated server-side on first request)
  // as soon as the dashboard loads.
  useEffect(() => {
    fetch(`/api/v1/projects/${projectId}/robots`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (data) setRobots(data);
      })
      // A network failure here just means the card never appears —
      // harmless, but left uncaught this would be an unhandled rejection.
      .catch((error: unknown) => console.error("Failed to fetch robots.txt", error));
  }, [projectId]);

  // Surfaces any past domain-event-handler failures (e.g. score
  // calculation crashing after a crawl) on load, not just right after a
  // fresh crawl — so a failure from an earlier session is never just
  // sitting invisibly in the database. See also the post-crawl fetch in
  // loadCrawlResults below, which catches failures sooner for a crawl just
  // run in this session.
  useEffect(() => {
    fetch(`/api/v1/projects/${projectId}/event-failures`)
      .then((response) => (response.ok ? response.json() : []))
      .then((data: EventFailureDto[]) => setEventFailures(data))
      .catch((error: unknown) => console.error("Failed to fetch event failures", error));
  }, [projectId]);

  // Without this, crawl/audit/sitemap/fixes/etc. only ever appear after a
  // crawl started in the CURRENT browser session — reloading the page (or
  // just coming back later) showed nothing even though a previous crawl's
  // results were sitting in the database all along.
  useEffect(() => {
    fetch(`/api/v1/projects/${projectId}/crawl`)
      .then((response) => (response.ok ? response.json() : null))
      .then((job: CrawlJobDto | null) => {
        if (!job) return;
        setCrawlJob(job);
        if (POLLABLE_STATUSES.has(job.status)) {
          pollCrawlJob(job.id);
        } else {
          void loadCrawlResults(job.id, job.status);
        }
      })
      .catch((error: unknown) => console.error("Failed to fetch latest crawl job", error));
    // Only ever run once on mount — pollCrawlJob/loadCrawlResults are
    // stable for the lifetime of this hook instance (recreated each
    // render, but always closing over the same projectId).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  // The audit run, sitemap, and schema markup are all triggered
  // server-side once the crawl job's status flips to COMPLETED,
  // asynchronously — so none may exist yet the instant the UI sees that
  // status. A short, bounded poll covers the gap without the UI needing to
  // know anything about how that's wired up. `isReady` distinguishes "not
  // generated yet" from "generated and legitimately empty" for endpoints
  // that return a collection rather than a single resource — defaults to
  // "any ok response is ready", which is correct for the singleton ones.
  async function pollForResource<T>(
    url: string,
    onFound: (value: T) => void,
    isReady: (value: T) => boolean = () => true
  ) {
    for (let attempt = 0; attempt < POLL_ATTEMPTS; attempt++) {
      try {
        const response = await fetch(url);
        if (response.ok) {
          const data: T = await response.json();
          if (isReady(data)) {
            onFound(data);
            return;
          }
        }
      } catch (error) {
        // A transient network blip on one attempt shouldn't abandon the
        // rest of the bounded retry — log and keep polling.
        console.error(`Poll attempt failed for ${url}`, error);
      }
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    }
  }

  // Pulled out of pollCrawlJob so the same "a job just finished, go load
  // everything it produced" logic can also run for a crawl that finished
  // in an earlier browser session — see the mount-time effect above.
  async function loadCrawlResults(jobId: string, status: CrawlJobDto["status"]) {
    const pagesResponse = await fetch(`/api/v1/projects/${projectId}/crawl/${jobId}/pages`).catch(
      (error: unknown) => {
        console.error("Failed to fetch crawled pages", error);
        return null;
      }
    );
    if (pagesResponse?.ok) setPages(await pagesResponse.json());
    if (status !== "COMPLETED") return;

    const auditUrl = `/api/v1/projects/${projectId}/crawl/${jobId}/audit`;
    void pollForResource<AuditRunDto>(auditUrl, setAuditRun).then(() => {
      // Recommendations are generated by a separate, slower queue/
      // worker (a real LLM call takes longer than everything else in
      // this pipeline) — once the AuditRun itself is visible, poll
      // the same endpoint again specifically for recommendations
      // landing on its issues.
      void pollForResource<AuditRunDto>(
        auditUrl,
        setAuditRun,
        (data) => data.issues.length === 0 || data.issues.every((issue) => issue.recommendation !== null)
      );
      // Delta is project-scoped (not crawl-job-scoped) and only ever
      // compares already-finished AuditRuns — by the time the poll
      // above resolves, this crawl's own AuditRun row is guaranteed
      // committed, so a single fetch (not a bounded poll) is enough.
      // A null body is a normal answer too (e.g. this project's very
      // first crawl has nothing yet to compare against).
      void fetch(`/api/v1/projects/${projectId}/delta`)
        .then((response) => (response.ok ? response.json() : null))
        .then((data) => setDelta(data))
        .catch((error: unknown) => console.error("Failed to fetch audit delta", error));
      // Same timing rationale as delta above — re-fetched here so a
      // failure from one of this crawl's own handlers (e.g. score
      // calculation) shows up promptly rather than only on next load.
      void fetch(`/api/v1/projects/${projectId}/event-failures`)
        .then((response) => (response.ok ? response.json() : []))
        .then((data: EventFailureDto[]) => setEventFailures(data))
        .catch((error: unknown) => console.error("Failed to fetch event failures", error));
    });
    void pollForResource<SitemapFileDto>(`/api/v1/projects/${projectId}/sitemap`, setSitemap);
    void pollForResource<LlmsTxtFileDto>(`/api/v1/projects/${projectId}/llms-txt`, setLlmsTxt);
    void pollForResource<SchemaMarkupDto[]>(
      `/api/v1/projects/${projectId}/crawl/${jobId}/schema`,
      setSchemaMarkup,
      (data) => data.length > 0
    );
    void pollForResource<SeoScoreDto[]>(
      `/api/v1/projects/${projectId}/crawl/${jobId}/scores`,
      setScores,
      (data) => data.length > 0
    );
    void pollForResource<FixCandidateDto[]>(
      `/api/v1/projects/${projectId}/crawl/${jobId}/fixes`,
      setFixCandidates,
      (data) => data.length > 0
    );
  }

  function pollCrawlJob(jobId: string) {
    if (pollRef.current) clearInterval(pollRef.current);

    pollRef.current = setInterval(async () => {
      let response: Response;
      try {
        response = await fetch(`/api/v1/projects/${projectId}/crawl/${jobId}`);
      } catch (error) {
        // A transient blip — the interval just tries again on the next
        // tick rather than tearing down the poll over one failed request.
        console.error("Crawl status poll failed", error);
        return;
      }
      if (!response.ok) return;
      const job: CrawlJobDto = await response.json();
      setCrawlJob(job);

      if (!POLLABLE_STATUSES.has(job.status)) {
        if (pollRef.current) clearInterval(pollRef.current);
        await loadCrawlResults(jobId, job.status);
      }
    }, 1500);
  }

  async function handleStartCrawl() {
    setIsStartingCrawl(true);
    setCrawlError(null);
    setPages([]);
    setAuditRun(null);
    setScores([]);
    setSitemap(null);
    setLlmsTxt(null);
    setSchemaMarkup([]);
    setFixCandidates([]);
    setDelta(null);

    let response: Response;
    try {
      response = await fetch(`/api/v1/projects/${projectId}/crawl`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });
    } catch {
      setIsStartingCrawl(false);
      setCrawlError(t("networkErrorRetry"));
      return;
    }
    const data = await response.json();

    setIsStartingCrawl(false);
    if (!response.ok) {
      setCrawlError(data.error ?? t("failedToStartCrawl"));
      return;
    }

    setCrawlJob(data);
    pollCrawlJob(data.id);
  }

  async function handleApplyFix(fixId: string) {
    setFixActionPendingId(fixId);
    setFixActionErrors((errors) => ({ ...errors, [fixId]: "" }));

    let response: Response;
    try {
      response = await fetch(`/api/v1/projects/${projectId}/fixes/${fixId}/apply`, { method: "POST" });
    } catch {
      setFixActionPendingId(null);
      setFixActionErrors((errors) => ({ ...errors, [fixId]: t("networkErrorRetry") }));
      return;
    }
    const data = await response.json();

    setFixActionPendingId(null);
    if (!response.ok) {
      setFixActionErrors((errors) => ({ ...errors, [fixId]: data.error ?? t("failedToApplyFix") }));
      return;
    }

    setFixCandidates((candidates) => candidates.map((candidate) => (candidate.id === fixId ? data : candidate)));
  }

  async function handleRevertFix(fixId: string) {
    setFixActionPendingId(fixId);
    setFixActionErrors((errors) => ({ ...errors, [fixId]: "" }));

    let response: Response;
    try {
      response = await fetch(`/api/v1/projects/${projectId}/fixes/${fixId}/revert`, { method: "POST" });
    } catch {
      setFixActionPendingId(null);
      setFixActionErrors((errors) => ({ ...errors, [fixId]: t("networkErrorRetry") }));
      return;
    }
    const data = await response.json();

    setFixActionPendingId(null);
    if (!response.ok) {
      setFixActionErrors((errors) => ({ ...errors, [fixId]: data.error ?? t("failedToRevertFix") }));
      return;
    }

    setFixCandidates((candidates) => candidates.map((candidate) => (candidate.id === fixId ? data : candidate)));
  }

  // Applies every ready fix in one rule/route-template group with a single
  // click. Always resolves (never throws) — a partial failure just leaves
  // the failed candidates' own per-fix error state populated (via
  // fixActionErrors, the same map handleApplyFix already uses), so each
  // failed row still shows its own actionable error rather than the whole
  // group silently failing together.
  async function handleApplyFixAll(groupKey: string, fixCandidateIds: string[]) {
    setFixAllPendingKey(groupKey);
    setFixAllErrors((errors) => ({ ...errors, [groupKey]: "" }));

    let response: Response;
    try {
      response = await fetch(`/api/v1/projects/${projectId}/fixes/apply-batch`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ fixCandidateIds }),
      });
    } catch {
      setFixAllPendingKey(null);
      setFixAllErrors((errors) => ({ ...errors, [groupKey]: t("networkErrorRetry") }));
      return;
    }
    const data = await response.json();

    setFixAllPendingKey(null);
    if (!response.ok) {
      setFixAllErrors((errors) => ({ ...errors, [groupKey]: data.error ?? t("failedToApplyFix") }));
      return;
    }

    const results: Array<{ fixCandidateId: string; status: "applied" | "failed"; error?: string }> = data.results;
    const failedById = new Map(results.filter((r) => r.status === "failed").map((r) => [r.fixCandidateId, r.error]));

    // Re-fetch rather than patch fixCandidates locally — an applied
    // candidate's previousValue (needed for the Revert button) is set
    // server-side and never comes back in the batch response, only a
    // fresh read of the full list has it.
    if (crawlJob) {
      const refreshed = await fetch(`/api/v1/projects/${projectId}/crawl/${crawlJob.id}/fixes`)
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null);
      if (refreshed) setFixCandidates(refreshed);
    }
    if (failedById.size > 0) {
      setFixActionErrors((errors) => {
        const next = { ...errors };
        for (const [id, error] of failedById) next[id] = error ?? t("failedToApplyFix");
        return next;
      });
      setFixAllErrors((errors) => ({
        ...errors,
        [groupKey]: t("fixAllPartialFailure")
          .replace("{failed}", String(failedById.size))
          .replace("{total}", String(fixCandidateIds.length)),
      }));
    }
  }

  function toggleRuleExpanded(ruleId: string) {
    setExpandedRuleIds((current) => {
      const next = new Set(current);
      if (next.has(ruleId)) next.delete(ruleId);
      else next.add(ruleId);
      return next;
    });
  }

  // Preserves first-seen order (already roughly priority-sorted by the
  // backend) rather than re-sorting groups by size — a CRITICAL rule
  // affecting 2 pages should still surface above an INFO rule affecting 20.
  //
  // Within a rule, issues are further split by routeTemplate (e.g.
  // /post/[id]) — a rule firing on 12 /post/[id] instances and 10
  // /profile/[id] instances is two structurally distinct fixes ("fix the
  // post template" vs "fix the profile template"), not one flat pile of
  // 22 rows. Only templates with 2+ affected pages get their own
  // collapsible sub-summary; issues with no template match (routeTemplate
  // null, e.g. no page URL available) or a template that only matched one
  // page fall back to being listed individually, same as before this
  // grouping existed.
  const issueGroups: IssueGroup[] = useMemo(() => {
    if (!auditRun) return [];
    const order: string[] = [];
    const byRule = new Map<string, AuditIssueDto[]>();
    for (const issue of auditRun.issues) {
      const existing = byRule.get(issue.ruleId);
      if (existing) {
        existing.push(issue);
      } else {
        byRule.set(issue.ruleId, [issue]);
        order.push(issue.ruleId);
      }
    }
    return order.map((ruleId) => {
      const issues = byRule.get(ruleId) ?? [];

      const templateOrder: string[] = [];
      const byTemplate = new Map<string, AuditIssueDto[]>();
      for (const issue of issues) {
        if (!issue.routeTemplate) continue;
        const existing = byTemplate.get(issue.routeTemplate);
        if (existing) existing.push(issue);
        else {
          byTemplate.set(issue.routeTemplate, [issue]);
          templateOrder.push(issue.routeTemplate);
        }
      }

      const templateGroups = templateOrder
        .map((routeTemplate) => ({ routeTemplate, issues: byTemplate.get(routeTemplate) ?? [] }))
        .filter((group) => group.issues.length > 1);
      const templatedIssueIds = new Set(templateGroups.flatMap((group) => group.issues.map((issue) => issue.id)));
      const ungroupedIssues = issues.filter((issue) => !templatedIssueIds.has(issue.id));

      return { ruleId, issues, templateGroups, ungroupedIssues };
    });
  }, [auditRun]);

  return {
    crawlJob,
    pages,
    isStartingCrawl,
    crawlError,
    auditRun,
    scores,
    sitemap,
    showSitemapXml,
    setShowSitemapXml,
    llmsTxt,
    showLlmsTxt,
    setShowLlmsTxt,
    robots,
    showRobotsTxt,
    setShowRobotsTxt,
    schemaMarkup,
    expandedSchemaId,
    setExpandedSchemaId,
    fixCandidates,
    copiedFixId,
    setCopiedFixId,
    copiedFullReport,
    setCopiedFullReport,
    delta,
    eventFailures,
    fixActionPendingId,
    fixActionErrors,
    fixAllPendingKey,
    fixAllErrors,
    expandedRuleIds,
    toggleRuleExpanded,
    issueGroups,
    handleStartCrawl,
    handleApplyFix,
    handleRevertFix,
    handleApplyFixAll,
  };
}
