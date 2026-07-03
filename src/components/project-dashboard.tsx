"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/hooks/use-language";
import type { ProjectDto } from "@/application/projects/dto";
import type { CrawlJobDto, PageDto } from "@/application/crawling/dto";
import type { AuditIssueDto, AuditRunDto } from "@/application/auditing/dto";
import type { SitemapFileDto } from "@/application/sitemap/dto";
import type { LlmsTxtFileDto } from "@/application/llms-txt/dto";
import type { RobotsFileDto } from "@/application/robots/dto";
import type { SchemaMarkupDto } from "@/application/schema-markup/dto";
import type { SeoScoreDto } from "@/application/scoring/dto";
import type { FixCandidateDto } from "@/application/fixes/dto";
import type { AuditDeltaDto } from "@/application/delta-audit/dto";
import type { WordPressConnectionDto } from "@/application/wordpress/dto";
import type { SearchPerformanceSnapshotDto, AnalyticsSnapshotDto, KeywordOpportunityDto, KeywordCannibalizationIssueDto, CtrUnderperformerDto } from "@/application/tracking/dto";
import type { ContentIdeaDto, GrowthAnalysisDto, PageContentDraftDto } from "@/application/content-enrichment/dto";
import type { AiVisibilityRunDto } from "@/application/ai-visibility/dto";
import { formatAuditReport } from "@/lib/format-audit-report";

type KeywordOpportunityRow = KeywordOpportunityDto & { suggestion: string | null };

type GoogleStatusDto =
  | { connected: false }
  | {
      connected: true;
      gscSiteUrl: string | null;
      ga4PropertyId: string | null;
      autoRefreshEnabled: boolean;
      createdAt: string;
      availableSites?: string[];
    };

interface EventFailureDto {
  id: string;
  eventType: string;
  message: string;
  occurredAt: string;
}

const CATEGORY_LABEL: Record<string, string> = {
  technical: "Technical",
  content: "Content",
  performance: "Performance",
  structured_data: "Structured Data",
};

const POLLABLE_STATUSES = new Set(["PENDING", "RUNNING"]);
const POLL_ATTEMPTS = 10;
const POLL_INTERVAL_MS = 1000;

// Grouping cards into tabs (rather than one long stacked column) keeps a
// big issue list from burying Outputs/Integrations far down the page —
// the exact complaint that prompted this. Pure presentation: no fetching
// or state logic changes based on which tab is active.
type TabId = "overview" | "issues" | "growth" | "integrations" | "outputs";
const TABS: Array<{ id: TabId; key: TranslationKey }> = [
  { id: "overview", key: "tabOverview" },
  { id: "issues", key: "tabIssues" },
  { id: "growth", key: "tabGrowth" },
  { id: "integrations", key: "tabIntegrations" },
  { id: "outputs", key: "tabOutputs" },
];

// Scoped translation: headings, tab names, and primary buttons only — not
// every microcopy string (error messages, table headers, dynamic counts
// stay English). Matches the same EN/TR split as the Guide page, but as a
// lookup table instead of parallel JSX trees, since this component is
// already large.
const TRANSLATIONS = {
  allSites: { en: "All sites", tr: "Tüm siteler" },
  guide: { en: "Guide", tr: "Kılavuz" },
  settings: { en: "Settings", tr: "Ayarlar" },
  verified: { en: "Verified", tr: "Doğrulandı" },
  unverified: { en: "Unverified", tr: "Doğrulanmadı" },
  tabOverview: { en: "Overview", tr: "Genel Bakış" },
  tabIssues: { en: "Issues & Fixes", tr: "Sorunlar & Düzeltmeler" },
  tabGrowth: { en: "Growth", tr: "Büyüme" },
  tabIntegrations: { en: "Integrations", tr: "Entegrasyonlar" },
  tabOutputs: { en: "Outputs", tr: "Çıktılar" },
  cardCrawl: { en: "Crawl", tr: "Tarama" },
  cardAuditScore: { en: "Audit Score", tr: "Denetim Skoru" },
  cardTrend: { en: "Trend", tr: "Trend" },
  cardAudit: { en: "Audit", tr: "Denetim" },
  cardAiVisibility: { en: "AI Visibility", tr: "AI Görünürlük" },
  cardWordPress: { en: "WordPress", tr: "WordPress" },
  cardSearchPerformance: { en: "Search Performance", tr: "Arama Performansı" },
  cardRobots: { en: "Robots.txt", tr: "Robots.txt" },
  cardSchema: { en: "Schema Markup", tr: "Şema İşaretleme" },
  cardSitemap: { en: "Sitemap", tr: "Site Haritası" },
  cardLlmsTxt: { en: "llms.txt", tr: "llms.txt" },
  cardVerify: { en: "Verify domain ownership", tr: "Domain sahipliğini doğrula" },
  startCrawl: { en: "Start crawl", tr: "Taramayı başlat" },
  starting: { en: "Starting…", tr: "Başlatılıyor…" },
  crawling: { en: "Crawling…", tr: "Taranıyor…" },
  checkVerification: { en: "Check verification", tr: "Doğrulamayı kontrol et" },
  checking: { en: "Checking…", tr: "Kontrol ediliyor…" },
  connect: { en: "Connect", tr: "Bağlan" },
  connecting: { en: "Connecting…", tr: "Bağlanıyor…" },
  disconnect: { en: "Disconnect", tr: "Bağlantıyı kes" },
  disconnecting: { en: "Disconnecting…", tr: "Bağlantı kesiliyor…" },
  copy: { en: "Copy", tr: "Kopyala" },
  copied: { en: "Copied!", tr: "Kopyalandı!" },
  copyFullReport: { en: "Copy full report", tr: "Tüm raporu kopyala" },
  approveApply: { en: "Approve & Apply", tr: "Onayla & Uygula" },
  applying: { en: "Applying…", tr: "Uygulanıyor…" },
  revert: { en: "Revert", tr: "Geri al" },
  reverting: { en: "Reverting…", tr: "Geri alınıyor…" },
  viewIssuesAndFixes: { en: "View issues & fixes →", tr: "Sorunları & düzeltmeleri gör →" },
  cardAutoPilot: { en: "Otomatik Pilot", tr: "Otomatik Pilot" },
  autoPilotDescription: {
    en: "When on, this project re-crawls itself daily and automatically applies Title/Meta description fixes to your connected WordPress site — every other fix type stays manual.",
    tr: "Açıkken bu proje her gün kendini yeniden tarar ve bağlı WordPress sitenizdeki Title/Meta description düzeltmelerini otomatik uygular — diğer tüm düzeltme tipleri manuel kalır.",
  },
  autoPilotNoWordPress: {
    en: "Re-crawling will run daily; connect WordPress above to also enable auto-apply.",
    tr: "Yeniden tarama her gün çalışacak; otomatik uygulamayı açmak için yukarıdan WordPress'e bağlanın.",
  },
  autoPilotOn: { en: "On", tr: "Açık" },
  autoPilotOff: { en: "Off", tr: "Kapalı" },
  autoPilotUpdating: { en: "Updating…", tr: "Güncelleniyor…" },
  publish: { en: "Publish to WordPress", tr: "WordPress'e yayınla" },
  publishing: { en: "Publishing…", tr: "Yayınlanıyor…" },
  published: { en: "Published", tr: "Yayınlandı" },
  publishFailed: { en: "Publish failed", tr: "Yayınlama başarısız" },
  draftNeedsWordPress: { en: "Connect WordPress above to publish this draft directly.", tr: "Bu taslağı doğrudan yayınlamak için yukarıdan WordPress'e bağlanın." },
} as const;
type TranslationKey = keyof typeof TRANSLATIONS;

const SEVERITY_BADGE_VARIANT: Record<string, "default" | "secondary" | "destructive"> = {
  CRITICAL: "destructive",
  WARNING: "default",
  INFO: "secondary",
};

const FIX_TYPE_LABEL: Record<string, string> = {
  TITLE: "Title",
  META_DESCRIPTION: "Meta description",
  H1: "H1",
  CANONICAL_URL: "Canonical URL",
};

const SOURCE_LABEL: Record<string, string> = {
  rule_based: "rule-based",
  ai_generated: "AI-generated",
  manual: "manual",
};

const PRIORITY_TIER_LABEL: Record<string, string> = {
  QUICK_WIN: "Quick win",
  MANUAL_REVIEW: "Needs review",
  FILL_IN: "Fill-in",
  LOW_PRIORITY: "Low priority",
};

const PRIORITY_ORDER: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };

const PRIORITY_BADGE_VARIANT: Record<string, "default" | "secondary" | "destructive"> = {
  HIGH: "destructive",
  MEDIUM: "default",
  LOW: "secondary",
};

const EVENT_TYPE_LABEL: Record<string, string> = {
  CrawlJobCompleted: "Processing the crawl results",
  AuditRunCompleted: "Processing the audit results",
};

export function ProjectDashboard({ project: initialProject }: { project: ProjectDto }) {
  const [project, setProject] = useState(initialProject);
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [language, setLanguage] = useLanguage();
  const t = (key: TranslationKey) => TRANSLATIONS[key][language];
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyMessage, setVerifyMessage] = useState<string | null>(null);

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

  const [wordPressConnection, setWordPressConnection] = useState<WordPressConnectionDto | null>(null);
  const [wpSiteUrl, setWpSiteUrl] = useState("");
  const [wpUsername, setWpUsername] = useState("");
  const [wpApplicationPassword, setWpApplicationPassword] = useState("");
  const [isConnectingWordPress, setIsConnectingWordPress] = useState(false);
  const [isDisconnectingWordPress, setIsDisconnectingWordPress] = useState(false);
  const [wordPressError, setWordPressError] = useState<string | null>(null);
  const [isUpdatingAutoPilot, setIsUpdatingAutoPilot] = useState(false);
  // Per-fix, not global — applying/reverting one fix candidate shouldn't
  // disable the buttons on every other one.
  const [fixActionPendingId, setFixActionPendingId] = useState<string | null>(null);
  const [fixActionErrors, setFixActionErrors] = useState<Record<string, string>>({});
  // Which rule-id groups are expanded in the Issues tab — the same
  // underlying defect (e.g. a client-rendered page template) often fires
  // the same rule on a dozen pages, and a flat list of 184 individual
  // findings reads as 184 distinct problems rather than ~10 real ones.
  // Groups with only one affected page render without a toggle at all.
  const [expandedRuleIds, setExpandedRuleIds] = useState<Set<string>>(new Set());

  const [googleStatus, setGoogleStatus] = useState<GoogleStatusDto>({ connected: false });
  const [isConnectingGoogle, setIsConnectingGoogle] = useState(false);
  const [isDisconnectingGoogle, setIsDisconnectingGoogle] = useState(false);
  const [isRefreshingGoogle, setIsRefreshingGoogle] = useState(false);
  const [googleError, setGoogleError] = useState<string | null>(null);
  const [ga4PropertyIdInput, setGa4PropertyIdInput] = useState("");
  const [searchPerformance, setSearchPerformance] = useState<SearchPerformanceSnapshotDto[]>([]);
  const [analyticsSnapshots, setAnalyticsSnapshots] = useState<AnalyticsSnapshotDto[]>([]);
  const [keywordOpportunities, setKeywordOpportunities] = useState<KeywordOpportunityRow[]>([]);
  const [keywordCannibalization, setKeywordCannibalization] = useState<KeywordCannibalizationIssueDto[]>([]);
  const [ctrUnderperformers, setCtrUnderperformers] = useState<CtrUnderperformerDto[]>([]);
  const [generatingSuggestionId, setGeneratingSuggestionId] = useState<string | null>(null);
  const [suggestionError, setSuggestionError] = useState<Record<string, string>>({});
  const [copiedSuggestionId, setCopiedSuggestionId] = useState<string | null>(null);

  const [contentIdeas, setContentIdeas] = useState<ContentIdeaDto[]>([]);
  const [isGeneratingContentIdeas, setIsGeneratingContentIdeas] = useState(false);
  const [contentIdeasError, setContentIdeasError] = useState<string | null>(null);
  const [copiedContentIdeaId, setCopiedContentIdeaId] = useState<string | null>(null);

  const [growthAnalysis, setGrowthAnalysis] = useState<GrowthAnalysisDto | null>(null);
  const [isGeneratingGrowthAnalysis, setIsGeneratingGrowthAnalysis] = useState(false);
  const [growthAnalysisError, setGrowthAnalysisError] = useState<string | null>(null);

  const [aiVisibility, setAiVisibility] = useState<AiVisibilityRunDto | null>(null);
  const [isProbingAiVisibility, setIsProbingAiVisibility] = useState(false);
  const [aiVisibilityError, setAiVisibilityError] = useState<string | null>(null);
  const [aiVisibilityQueries, setAiVisibilityQueries] = useState("");
  const [aiVisibilityCompetitors, setAiVisibilityCompetitors] = useState("");

  const [contentDrafts, setContentDrafts] = useState<PageContentDraftDto[]>([]);
  const [draftPageUrl, setDraftPageUrl] = useState("");
  const [generatingDraft, setGeneratingDraft] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [copiedDraftUrl, setCopiedDraftUrl] = useState<string | null>(null);
  const [draftActionPendingId, setDraftActionPendingId] = useState<string | null>(null);
  const [draftActionErrors, setDraftActionErrors] = useState<Record<string, string>>({});

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
    fetch(`/api/v1/projects/${project.id}/robots`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (data) setRobots(data);
      })
      // A network failure here just means the card never appears —
      // harmless, but left uncaught this would be an unhandled rejection.
      .catch((error: unknown) => console.error("Failed to fetch robots.txt", error));
  }, [project.id]);

  // Content ideas have no dependency on Google being connected — they
  // come from the crawl's own page titles/H1s — so they're fetched
  // unconditionally, same as robots.txt above. An empty result just means
  // nobody has clicked "Generate content ideas" yet (or there's no crawl
  // to derive them from).
  useEffect(() => {
    fetch(`/api/v1/projects/${project.id}/content-ideas`)
      .then((response) => (response.ok ? response.json() : []))
      .then((data: ContentIdeaDto[]) => setContentIdeas(data))
      .catch((error: unknown) => console.error("Failed to fetch content ideas", error));
  }, [project.id]);

  // Same reasoning as content ideas above — a business-growth report has
  // no dependency on Google being connected, it's derived purely from the
  // crawl, so it's fetched unconditionally on mount.
  useEffect(() => {
    fetch(`/api/v1/projects/${project.id}/growth-analysis`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data: GrowthAnalysisDto | null) => setGrowthAnalysis(data))
      .catch((error: unknown) => console.error("Failed to fetch growth analysis", error));
  }, [project.id]);

  // Latest stored AI-visibility probe, if any — read-only on mount, same as
  // growth analysis above. A fresh probe is only run when the user clicks
  // Measure (a real, multi-call LLM cost).
  useEffect(() => {
    fetch(`/api/v1/projects/${project.id}/ai-visibility`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data: AiVisibilityRunDto | null) => setAiVisibility(data))
      .catch((error: unknown) => console.error("Failed to fetch AI visibility run", error));
  }, [project.id]);

  useEffect(() => {
    fetch(`/api/v1/projects/${project.id}/content-draft`)
      .then((response) => (response.ok ? response.json() : []))
      .then((data: PageContentDraftDto[]) => setContentDrafts(data))
      .catch((error: unknown) => console.error("Failed to fetch content drafts", error));
  }, [project.id]);

  // Surfaces any past domain-event-handler failures (e.g. score
  // calculation crashing after a crawl) on load, not just right after a
  // fresh crawl — so a failure from an earlier session is never just
  // sitting invisibly in the database. See also the post-crawl fetch in
  // pollCrawlJob below, which catches failures sooner for a crawl just
  // run in this session.
  useEffect(() => {
    fetch(`/api/v1/projects/${project.id}/event-failures`)
      .then((response) => (response.ok ? response.json() : []))
      .then((data: EventFailureDto[]) => setEventFailures(data))
      .catch((error: unknown) => console.error("Failed to fetch event failures", error));
  }, [project.id]);

  // Also has no dependency on a crawl — a WordPress connection is set up
  // once per project and then just sits there until reconnected/removed.
  useEffect(() => {
    fetch(`/api/v1/projects/${project.id}/wordpress`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => setWordPressConnection(data))
      .catch((error: unknown) => console.error("Failed to fetch WordPress connection", error));
  }, [project.id]);

  // Without this, crawl/audit/sitemap/fixes/etc. only ever appear after a
  // crawl started in the CURRENT browser session — reloading the page (or
  // just coming back later) showed nothing even though a previous crawl's
  // results were sitting in the database all along.
  useEffect(() => {
    fetch(`/api/v1/projects/${project.id}/crawl`)
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
    // stable for the lifetime of this component instance (recreated each
    // render, but always closing over the same project.id).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id]);

  // Same independence from crawl state as WordPress above. Snapshots are
  // fetched separately from connection status (a plain GET of whatever's
  // already stored, not a live Google call) so reloading the dashboard
  // doesn't lose previously fetched tracking data.
  useEffect(() => {
    fetch(`/api/v1/projects/${project.id}/google`)
      .then((response) => (response.ok ? response.json() : { connected: false }))
      .then((data: GoogleStatusDto) => {
        setGoogleStatus(data);
        if (data.connected && data.ga4PropertyId) setGa4PropertyIdInput(data.ga4PropertyId);
      })
      .catch((error: unknown) => console.error("Failed to fetch Google connection status", error));

    fetch(`/api/v1/projects/${project.id}/google/snapshots`)
      .then((response) => (response.ok ? response.json() : null))
      .then(
        (
          data: {
            searchPerformance: SearchPerformanceSnapshotDto[];
            analytics: AnalyticsSnapshotDto[];
            keywordOpportunities: KeywordOpportunityRow[];
            keywordCannibalization: KeywordCannibalizationIssueDto[];
            ctrUnderperformers: CtrUnderperformerDto[];
          } | null
        ) => {
          if (data) {
            setSearchPerformance(data.searchPerformance);
            setAnalyticsSnapshots(data.analytics);
            setKeywordOpportunities(data.keywordOpportunities);
            setKeywordCannibalization(data.keywordCannibalization);
            setCtrUnderperformers(data.ctrUnderperformers);
          }
        }
      )
      .catch((error: unknown) => console.error("Failed to fetch Google tracking snapshots", error));
  }, [project.id]);

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

  async function handleVerify() {
    setIsVerifying(true);
    setVerifyMessage(null);

    let response: Response;
    try {
      response = await fetch(`/api/v1/projects/${project.id}/verify`, { method: "POST" });
    } catch {
      setIsVerifying(false);
      setVerifyMessage("Network error — check your connection and try again.");
      return;
    }
    const data = await response.json();

    setIsVerifying(false);
    if (!response.ok) {
      setVerifyMessage(data.error ?? "Verification check failed");
      return;
    }

    setProject(data);
    setVerifyMessage(data.isVerified ? "Domain verified!" : "Not verified yet — record not found.");
  }

  async function handleGenerateContentIdeas() {
    setIsGeneratingContentIdeas(true);
    setContentIdeasError(null);

    let response: Response;
    try {
      response = await fetch(`/api/v1/projects/${project.id}/content-ideas`, { method: "POST" });
    } catch {
      setIsGeneratingContentIdeas(false);
      setContentIdeasError("Network error — check your connection and try again.");
      return;
    }
    const data = await response.json();

    setIsGeneratingContentIdeas(false);
    if (!response.ok) {
      setContentIdeasError(data.error ?? "Failed to generate content ideas");
      return;
    }

    setContentIdeas(data);
  }

  async function handleRunAiVisibilityProbe() {
    const queries = aiVisibilityQueries
      .split("\n")
      .map((q) => q.trim())
      .filter((q) => q.length > 0);
    if (queries.length === 0) {
      setAiVisibilityError("Enter at least one target query (one per line).");
      return;
    }
    const competitors = aiVisibilityCompetitors
      .split(",")
      .map((c) => c.trim())
      .filter((c) => c.length > 0);

    setIsProbingAiVisibility(true);
    setAiVisibilityError(null);

    let response: Response;
    try {
      response = await fetch(`/api/v1/projects/${project.id}/ai-visibility`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ queries, competitors }),
      });
    } catch {
      setIsProbingAiVisibility(false);
      setAiVisibilityError("Network error — check your connection and try again.");
      return;
    }
    const data = await response.json();

    setIsProbingAiVisibility(false);
    if (!response.ok) {
      setAiVisibilityError(data.error ?? "Failed to run the AI visibility probe");
      return;
    }
    setAiVisibility(data);
  }

  async function handleGenerateGrowthAnalysis() {
    setIsGeneratingGrowthAnalysis(true);
    setGrowthAnalysisError(null);

    let response: Response;
    try {
      response = await fetch(`/api/v1/projects/${project.id}/growth-analysis`, { method: "POST" });
    } catch {
      setIsGeneratingGrowthAnalysis(false);
      setGrowthAnalysisError("Network error — check your connection and try again.");
      return;
    }
    const data = await response.json();

    setIsGeneratingGrowthAnalysis(false);
    if (!response.ok) {
      setGrowthAnalysisError(data.error ?? "Failed to generate the growth analysis");
      return;
    }

    setGrowthAnalysis(data);
  }

  async function handleGenerateDraft(pageUrl: string) {
    if (!pageUrl) return;
    setGeneratingDraft(true);
    setDraftError(null);

    let response: Response;
    try {
      response = await fetch(`/api/v1/projects/${project.id}/content-draft`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pageUrl }),
      });
    } catch {
      setGeneratingDraft(false);
      setDraftError("Network error — check your connection and try again.");
      return;
    }
    const data = await response.json();

    setGeneratingDraft(false);
    if (!response.ok) {
      setDraftError(data.error ?? "Failed to generate the content draft");
      return;
    }

    // Replace any existing draft for this page, else prepend the new one.
    setContentDrafts((drafts) => [data, ...drafts.filter((d) => d.pageUrl !== data.pageUrl)]);
  }

  async function handlePublishDraft(draftId: string) {
    setDraftActionPendingId(draftId);
    setDraftActionErrors((errors) => ({ ...errors, [draftId]: "" }));

    let response: Response;
    try {
      response = await fetch(`/api/v1/projects/${project.id}/content-draft/${draftId}/publish`, { method: "POST" });
    } catch {
      setDraftActionPendingId(null);
      setDraftActionErrors((errors) => ({ ...errors, [draftId]: "Network error — check your connection and try again." }));
      return;
    }
    const data = await response.json();

    setDraftActionPendingId(null);
    if (!response.ok) {
      setDraftActionErrors((errors) => ({ ...errors, [draftId]: data.error ?? "Failed to publish draft" }));
      return;
    }

    setContentDrafts((drafts) => drafts.map((draft) => (draft.id === draftId ? data : draft)));
  }

  async function handleRevertDraft(draftId: string) {
    setDraftActionPendingId(draftId);
    setDraftActionErrors((errors) => ({ ...errors, [draftId]: "" }));

    let response: Response;
    try {
      response = await fetch(`/api/v1/projects/${project.id}/content-draft/${draftId}/revert`, { method: "POST" });
    } catch {
      setDraftActionPendingId(null);
      setDraftActionErrors((errors) => ({ ...errors, [draftId]: "Network error — check your connection and try again." }));
      return;
    }
    const data = await response.json();

    setDraftActionPendingId(null);
    if (!response.ok) {
      setDraftActionErrors((errors) => ({ ...errors, [draftId]: data.error ?? "Failed to revert draft" }));
      return;
    }

    setContentDrafts((drafts) => drafts.map((draft) => (draft.id === draftId ? data : draft)));
  }

  function formatDraftForCopy(draft: PageContentDraftDto): string {
    const sections = draft.bodySections.map((s) => `## ${s.heading}\n${s.content}`).join("\n\n");
    const faqs = draft.faqs.map((f) => `Q: ${f.question}\nA: ${f.answer}`).join("\n\n");
    return [
      `Title: ${draft.suggestedTitle}`,
      `Meta description: ${draft.suggestedMetaDescription}`,
      "",
      sections,
      "",
      "FAQ",
      faqs,
    ].join("\n");
  }

  // Pulled out of pollCrawlJob so the same "a job just finished, go load
  // everything it produced" logic can also run for a crawl that finished
  // in an earlier browser session — see the mount-time effect below.
  async function loadCrawlResults(jobId: string, status: CrawlJobDto["status"]) {
    const pagesResponse = await fetch(`/api/v1/projects/${project.id}/crawl/${jobId}/pages`).catch(
      (error: unknown) => {
        console.error("Failed to fetch crawled pages", error);
        return null;
      }
    );
    if (pagesResponse?.ok) setPages(await pagesResponse.json());
    if (status !== "COMPLETED") return;

    const auditUrl = `/api/v1/projects/${project.id}/crawl/${jobId}/audit`;
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
      void fetch(`/api/v1/projects/${project.id}/delta`)
        .then((response) => (response.ok ? response.json() : null))
        .then((data) => setDelta(data))
        .catch((error: unknown) => console.error("Failed to fetch audit delta", error));
      // Same timing rationale as delta above — re-fetched here so a
      // failure from one of this crawl's own handlers (e.g. score
      // calculation) shows up promptly rather than only on next load.
      void fetch(`/api/v1/projects/${project.id}/event-failures`)
        .then((response) => (response.ok ? response.json() : []))
        .then((data: EventFailureDto[]) => setEventFailures(data))
        .catch((error: unknown) => console.error("Failed to fetch event failures", error));
    });
    void pollForResource<SitemapFileDto>(`/api/v1/projects/${project.id}/sitemap`, setSitemap);
    void pollForResource<LlmsTxtFileDto>(`/api/v1/projects/${project.id}/llms-txt`, setLlmsTxt);
    void pollForResource<SchemaMarkupDto[]>(
      `/api/v1/projects/${project.id}/crawl/${jobId}/schema`,
      setSchemaMarkup,
      (data) => data.length > 0
    );
    void pollForResource<SeoScoreDto[]>(
      `/api/v1/projects/${project.id}/crawl/${jobId}/scores`,
      setScores,
      (data) => data.length > 0
    );
    void pollForResource<FixCandidateDto[]>(
      `/api/v1/projects/${project.id}/crawl/${jobId}/fixes`,
      setFixCandidates,
      (data) => data.length > 0
    );
  }

  function pollCrawlJob(jobId: string) {
    if (pollRef.current) clearInterval(pollRef.current);

    pollRef.current = setInterval(async () => {
      let response: Response;
      try {
        response = await fetch(`/api/v1/projects/${project.id}/crawl/${jobId}`);
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
      response = await fetch(`/api/v1/projects/${project.id}/crawl`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });
    } catch {
      setIsStartingCrawl(false);
      setCrawlError("Network error — check your connection and try again.");
      return;
    }
    const data = await response.json();

    setIsStartingCrawl(false);
    if (!response.ok) {
      setCrawlError(data.error ?? "Failed to start crawl");
      return;
    }

    setCrawlJob(data);
    pollCrawlJob(data.id);
  }

  async function handleConnectWordPress(event: React.FormEvent) {
    event.preventDefault();
    setIsConnectingWordPress(true);
    setWordPressError(null);

    let response: Response;
    try {
      response = await fetch(`/api/v1/projects/${project.id}/wordpress`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ siteUrl: wpSiteUrl, username: wpUsername, applicationPassword: wpApplicationPassword }),
      });
    } catch {
      setIsConnectingWordPress(false);
      setWordPressError("Network error — check your connection and try again.");
      return;
    }
    const data = await response.json();

    setIsConnectingWordPress(false);
    if (!response.ok) {
      setWordPressError(data.error ?? "Failed to connect to WordPress");
      return;
    }

    setWordPressConnection(data);
    setWpSiteUrl("");
    setWpUsername("");
    setWpApplicationPassword("");
  }

  async function handleDisconnectWordPress() {
    setIsDisconnectingWordPress(true);
    try {
      await fetch(`/api/v1/projects/${project.id}/wordpress`, { method: "DELETE" });
      setWordPressConnection(null);
    } catch (error) {
      console.error("Failed to disconnect WordPress", error);
    } finally {
      setIsDisconnectingWordPress(false);
    }
  }

  async function handleToggleAutoPilot() {
    const nextValue = !project.autoPilotEnabled;
    setIsUpdatingAutoPilot(true);
    try {
      const response = await fetch(`/api/v1/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ autoPilotEnabled: nextValue }),
      });
      if (response.ok) {
        const data: ProjectDto = await response.json();
        setProject(data);
      }
    } catch (error) {
      console.error("Failed to update Otomatik Pilot", error);
    } finally {
      setIsUpdatingAutoPilot(false);
    }
  }

  // Longer/slower bound than pollForResource's — that helper is tuned for
  // fast server-side async work (a few seconds), but this poll is waiting
  // on a human to actually click through Google's consent screen in a
  // separate browser tab, which can reasonably take a minute or two.
  async function pollForGoogleConnection() {
    for (let attempt = 0; attempt < 90; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      try {
        const response = await fetch(`/api/v1/projects/${project.id}/google`);
        if (response.ok) {
          const data: GoogleStatusDto = await response.json();
          if (data.connected) {
            setGoogleStatus(data);
            if (data.ga4PropertyId) setGa4PropertyIdInput(data.ga4PropertyId);
            setIsConnectingGoogle(false);
            return;
          }
        }
      } catch (error) {
        console.error("Poll attempt failed while waiting for Google connection", error);
      }
    }
    setIsConnectingGoogle(false);
    setGoogleError("Timed out waiting for Google authorization — try connecting again.");
  }

  async function handleConnectGoogle() {
    setIsConnectingGoogle(true);
    setGoogleError(null);

    let response: Response;
    try {
      response = await fetch(`/api/v1/projects/${project.id}/google/connect`, { method: "POST" });
    } catch {
      setIsConnectingGoogle(false);
      setGoogleError("Network error — check your connection and try again.");
      return;
    }
    const data = await response.json();

    if (!response.ok) {
      setIsConnectingGoogle(false);
      setGoogleError(data.error ?? "Failed to start Google connection");
      return;
    }

    // Opens in the system browser, not an in-app popup — see
    // electron/main.ts's setWindowOpenHandler.
    window.open(data.authorizationUrl, "_blank");
    void pollForGoogleConnection();
  }

  async function handleDisconnectGoogle() {
    setIsDisconnectingGoogle(true);
    try {
      await fetch(`/api/v1/projects/${project.id}/google`, { method: "DELETE" });
      setGoogleStatus({ connected: false });
      setSearchPerformance([]);
      setAnalyticsSnapshots([]);
    } catch (error) {
      console.error("Failed to disconnect Google account", error);
    } finally {
      setIsDisconnectingGoogle(false);
    }
  }

  async function handleSelectGscSite(gscSiteUrl: string) {
    setGoogleError(null);
    try {
      const response = await fetch(`/api/v1/projects/${project.id}/google/site`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ gscSiteUrl }),
      });
      if (response.ok) {
        setGoogleStatus(await response.json());
      } else {
        const data = await response.json().catch(() => ({}));
        setGoogleError(data.error ?? "Failed to select the Search Console property");
      }
    } catch {
      setGoogleError("Network error — check your connection and try again.");
    }
  }

  async function handleSaveGa4Property(event: React.FormEvent) {
    event.preventDefault();
    setGoogleError(null);
    try {
      const response = await fetch(`/api/v1/projects/${project.id}/google/ga4-property`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ga4PropertyId: ga4PropertyIdInput }),
      });
      if (response.ok) {
        setGoogleStatus(await response.json());
      } else {
        const data = await response.json().catch(() => ({}));
        setGoogleError(data.error ?? "Failed to save the GA4 property id");
      }
    } catch {
      setGoogleError("Network error — check your connection and try again.");
    }
  }

  async function handleToggleAutoRefresh(enabled: boolean) {
    setGoogleError(null);
    try {
      const response = await fetch(`/api/v1/projects/${project.id}/google/auto-refresh`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      if (response.ok) {
        setGoogleStatus(await response.json());
      } else {
        const data = await response.json().catch(() => ({}));
        setGoogleError(data.error ?? "Failed to update auto-refresh");
      }
    } catch {
      setGoogleError("Network error — check your connection and try again.");
    }
  }

  async function handleRefreshGoogleTracking() {
    setIsRefreshingGoogle(true);
    setGoogleError(null);
    try {
      const response = await fetch(`/api/v1/projects/${project.id}/google/refresh`, { method: "POST" });
      const data = await response.json();
      if (data.searchPerformance?.status === "ok") setSearchPerformance(data.searchPerformance.snapshots);
      if (data.searchPerformance?.status === "error") setGoogleError(data.searchPerformance.error);
      if (data.analytics?.status === "ok") setAnalyticsSnapshots(data.analytics.snapshots);
      if (data.keywordOpportunities?.status === "ok") setKeywordOpportunities(data.keywordOpportunities.opportunities);
      if (data.keywordCannibalization?.status === "ok") setKeywordCannibalization(data.keywordCannibalization.issues);
      if (data.ctrUnderperformers?.status === "ok") setCtrUnderperformers(data.ctrUnderperformers.issues);
    } catch {
      setGoogleError("Network error — check your connection and try again.");
    } finally {
      setIsRefreshingGoogle(false);
    }
  }

  async function handleGenerateSuggestion(opportunityId: string) {
    setGeneratingSuggestionId(opportunityId);
    setSuggestionError((errors) => ({ ...errors, [opportunityId]: "" }));

    let response: Response;
    try {
      response = await fetch(`/api/v1/projects/${project.id}/keyword-opportunities/${opportunityId}/suggestion`, {
        method: "POST",
      });
    } catch {
      setGeneratingSuggestionId(null);
      setSuggestionError((errors) => ({ ...errors, [opportunityId]: "Network error — check your connection and try again." }));
      return;
    }
    const data = await response.json();
    setGeneratingSuggestionId(null);
    if (!response.ok) {
      setSuggestionError((errors) => ({ ...errors, [opportunityId]: data.error ?? "Failed to generate a suggestion." }));
      return;
    }
    setKeywordOpportunities((rows) =>
      rows.map((row) => (row.id === opportunityId ? { ...row, suggestion: data.content } : row))
    );
  }

  async function handleApplyFix(fixId: string) {
    setFixActionPendingId(fixId);
    setFixActionErrors((errors) => ({ ...errors, [fixId]: "" }));

    let response: Response;
    try {
      response = await fetch(`/api/v1/projects/${project.id}/fixes/${fixId}/apply`, { method: "POST" });
    } catch {
      setFixActionPendingId(null);
      setFixActionErrors((errors) => ({ ...errors, [fixId]: "Network error — check your connection and try again." }));
      return;
    }
    const data = await response.json();

    setFixActionPendingId(null);
    if (!response.ok) {
      setFixActionErrors((errors) => ({ ...errors, [fixId]: data.error ?? "Failed to apply fix" }));
      return;
    }

    setFixCandidates((candidates) => candidates.map((candidate) => (candidate.id === fixId ? data : candidate)));
  }

  async function handleRevertFix(fixId: string) {
    setFixActionPendingId(fixId);
    setFixActionErrors((errors) => ({ ...errors, [fixId]: "" }));

    let response: Response;
    try {
      response = await fetch(`/api/v1/projects/${project.id}/fixes/${fixId}/revert`, { method: "POST" });
    } catch {
      setFixActionPendingId(null);
      setFixActionErrors((errors) => ({ ...errors, [fixId]: "Network error — check your connection and try again." }));
      return;
    }
    const data = await response.json();

    setFixActionPendingId(null);
    if (!response.ok) {
      setFixActionErrors((errors) => ({ ...errors, [fixId]: data.error ?? "Failed to revert fix" }));
      return;
    }

    setFixCandidates((candidates) => candidates.map((candidate) => (candidate.id === fixId ? data : candidate)));
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
  const issueGroups = useMemo(() => {
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
    return order.map((ruleId) => ({ ruleId, issues: byRule.get(ruleId) ?? [] }));
  }, [auditRun]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/"
            className="mb-1 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            ← {t("allSites")}
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">{project.name}</h1>
          <p className="text-sm text-muted-foreground">{project.domain}</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant={project.isVerified ? "default" : "secondary"}>
            {project.isVerified ? t("verified") : t("unverified")}
          </Badge>
          <div className="flex gap-1">
            <Button
              variant={language === "en" ? "default" : "outline"}
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => setLanguage("en")}
            >
              EN
            </Button>
            <Button
              variant={language === "tr" ? "default" : "outline"}
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => setLanguage("tr")}
            >
              TR
            </Button>
          </div>
          <Link href="/guide" className="text-sm text-muted-foreground hover:text-foreground">
            {t("guide")}
          </Link>
          <Link href="/settings" className="text-sm text-muted-foreground hover:text-foreground">
            {t("settings")}
          </Link>
        </div>
      </div>

      {eventFailures.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-red-400">Some background processing failed</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            <p className="text-muted-foreground">
              These steps failed and won&apos;t retry automatically — some results above may be missing.
            </p>
            {eventFailures.map((failure) => (
              <div key={failure.id} className="border-b border-white/10 py-1">
                <p className="font-medium">{EVENT_TYPE_LABEL[failure.eventType] ?? failure.eventType}</p>
                <p className="text-xs text-muted-foreground">{failure.message}</p>
                <p className="text-xs text-muted-foreground/70">{new Date(failure.occurredAt).toLocaleString()}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {!project.isVerified && (
        <Card>
          <CardHeader>
            <CardTitle>{t("cardVerify")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            <p className="text-muted-foreground">
              Crawling and auditing work without this — verification is only required to connect WordPress and
              auto-apply fixes to your live site. Prove ownership with one of the following, then check
              verification.
            </p>
            <div className="rounded-lg border border-white/10 bg-black/20 p-3 font-mono text-xs">
              <p>DNS TXT record:</p>
              <p>{project.dnsTxtRecordName} = {project.verificationToken}</p>
            </div>
            <div className="rounded-lg border border-white/10 bg-black/20 p-3 font-mono text-xs">
              <p>or file at {project.wellKnownFileUrl}:</p>
              <p>{project.verificationToken}</p>
            </div>
            <Button onClick={handleVerify} disabled={isVerifying} className="self-start">
              {isVerifying ? t("checking") : t("checkVerification")}
            </Button>
            {verifyMessage && <p className="text-muted-foreground">{verifyMessage}</p>}
          </CardContent>
        </Card>
      )}

      <div className="flex gap-2 overflow-x-auto border-b border-white/10 pb-2">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "shrink-0 rounded-lg px-3 py-1.5 text-sm transition",
              activeTab === tab.id
                ? "bg-white/10 text-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-white/5"
            )}
          >
            {t(tab.key)}
            {tab.id === "issues" && auditRun && auditRun.issues.length > 0 && (
              <span className="ml-1.5 text-xs text-muted-foreground">({auditRun.issues.length})</span>
            )}
          </button>
        ))}
      </div>

      {activeTab === "overview" && (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>{t("cardCrawl")}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-sm">
              <Button
                onClick={handleStartCrawl}
                disabled={isStartingCrawl || (crawlJob ? POLLABLE_STATUSES.has(crawlJob.status) : false)}
                className="self-start"
              >
                {isStartingCrawl
                  ? t("starting")
                  : crawlJob && POLLABLE_STATUSES.has(crawlJob.status)
                    ? t("crawling")
                    : t("startCrawl")}
              </Button>
              {crawlError && <p className="text-red-400">{crawlError}</p>}

              {crawlJob && (
                <div className="flex flex-col gap-1 text-muted-foreground">
                  <p>
                    Status: <span className="font-medium text-foreground">{crawlJob.status}</span>
                    {" · "}
                    Pages crawled: {crawlJob.pageCount}
                  </p>
                  {crawlJob.error && <p className="text-red-400">{crawlJob.error}</p>}
                </div>
              )}

              {pages.length > 0 && (
                <div className="mt-2 flex max-h-64 flex-col gap-2 overflow-y-auto">
                  {pages.map((page) => (
                    <div key={page.id} className="flex items-center justify-between border-b py-1">
                      <div>
                        <p className="font-medium">{page.title ?? "(no title)"}</p>
                        <p className="text-xs text-muted-foreground">{page.url}</p>
                      </div>
                      <span className="text-xs text-muted-foreground">{page.statusCode ?? "—"}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {auditRun && (
            <Card>
              <CardHeader>
                <CardTitle>{t("cardAuditScore")}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3 text-sm">
                <p className="text-muted-foreground">
                  Score: <span className="text-lg font-medium text-foreground">{auditRun.overallScore}</span> / 100
                  {" · "}
                  {auditRun.issues.length} issue{auditRun.issues.length === 1 ? "" : "s"}
                </p>
                {scores.length > 0 && (
                  <div className="flex flex-wrap gap-4">
                    {scores.map((score) => (
                      <p key={score.category} className="text-xs text-muted-foreground">
                        {CATEGORY_LABEL[score.category] ?? score.category}:{" "}
                        <span className="font-medium text-foreground">{score.score}</span>
                      </p>
                    ))}
                  </div>
                )}
                {auditRun.issues.length > 0 && (
                  <Button variant="outline" size="sm" className="self-start" onClick={() => setActiveTab("issues")}>
                    {t("viewIssuesAndFixes")}
                  </Button>
                )}
              </CardContent>
            </Card>
          )}

          {delta && (
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>{t("cardTrend")}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3 text-sm">
                <p className="text-muted-foreground">
                  Score: <span className="font-medium text-foreground">{delta.previousScore}</span>
                  {" → "}
                  <span className="font-medium text-foreground">{delta.currentScore}</span>
                  {delta.scoreDelta !== null && (
                    <span className={delta.scoreDelta >= 0 ? "text-green-400" : "text-red-400"}>
                      {" "}({delta.scoreDelta >= 0 ? "+" : ""}
                      {delta.scoreDelta})
                    </span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground">
                  {delta.previousPageCount} → {delta.currentPageCount} pages crawled
                  {delta.currentPageCount !== delta.previousPageCount && (
                    <>
                      {" — "}
                      score is a per-page average, so a deeper crawl can shift the issue count a lot while the score
                      barely moves
                    </>
                  )}
                </p>
                <div className="flex gap-4 text-xs text-muted-foreground">
                  <p>{delta.resolvedCount} resolved</p>
                  <p>{delta.newCount} new</p>
                  <p>{delta.persistingCount} unchanged</p>
                </div>
                {delta.issues.filter((issue) => issue.changeType !== "PERSISTING").length > 0 && (
                  <div className="flex flex-col gap-1">
                    {delta.issues
                      .filter((issue) => issue.changeType !== "PERSISTING")
                      .map((issue, index) => (
                        <div
                          key={`${issue.pageUrl}-${issue.ruleId}-${index}`}
                          className="flex items-center justify-between gap-3 border-b py-1 text-xs"
                        >
                          <div>
                            <p>{issue.message}</p>
                            <p className="text-muted-foreground">{issue.ruleId}</p>
                          </div>
                          <Badge variant={issue.changeType === "RESOLVED" ? "default" : "destructive"}>
                            {issue.changeType === "RESOLVED" ? "Fixed" : "New"}
                          </Badge>
                        </div>
                      ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {(pages.length > 0 || contentIdeas.length > 0) && (
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>Content Ideas</CardTitle>
                <CardAction>
                  <Button onClick={handleGenerateContentIdeas} disabled={isGeneratingContentIdeas} size="sm">
                    {isGeneratingContentIdeas
                      ? "Generating…"
                      : contentIdeas.length > 0
                        ? "Regenerate"
                        : "Generate content ideas"}
                  </Button>
                </CardAction>
              </CardHeader>
              <CardContent className="flex flex-col gap-3 text-sm">
                <p className="text-muted-foreground">
                  New-page ideas based on your existing pages&apos; topics — common questions people ask that this
                  site doesn&apos;t appear to have a dedicated page for yet. These are LLM-generated ideas to
                  consider, not measured search data or a guarantee of traffic.
                </p>
                {contentIdeasError && <p className="text-red-400">{contentIdeasError}</p>}
                {contentIdeas.length > 0 && (
                  <div className="flex flex-col gap-2">
                    {contentIdeas.map((idea) => (
                      <div key={idea.id} className="rounded-lg border border-white/10 bg-black/20 p-2">
                        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                          <span className="text-xs font-medium">{idea.suggestedTitle}</span>
                          <span className="text-xs text-muted-foreground">{idea.suggestedSlug}</span>
                        </div>
                        <p className="truncate text-xs text-muted-foreground" title={idea.sourcePageUrl}>
                          From: {idea.sourcePageUrl}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">{idea.rationale}</p>
                        <Button
                          className="mt-2"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            void navigator.clipboard.writeText(
                              `${idea.suggestedTitle}\n${idea.suggestedSlug}\n\n${idea.rationale}`
                            );
                            setCopiedContentIdeaId(idea.id);
                            setTimeout(() => setCopiedContentIdeaId((id) => (id === idea.id ? null : id)), 1500);
                          }}
                        >
                          {copiedContentIdeaId === idea.id ? t("copied") : t("copy")}
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {activeTab === "issues" && (
        <Card>
          <CardHeader>
            <CardTitle>{t("cardAudit")}</CardTitle>
            {auditRun && auditRun.issues.length > 0 && (
              <CardAction>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    void navigator.clipboard.writeText(formatAuditReport(project.domain, auditRun, fixCandidates));
                    setCopiedFullReport(true);
                    setTimeout(() => setCopiedFullReport(false), 1500);
                  }}
                >
                  {copiedFullReport ? t("copied") : t("copyFullReport")}
                </Button>
              </CardAction>
            )}
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            {auditRun ? (
              <>
                <p className="text-muted-foreground">
                  Score: <span className="text-lg font-medium text-foreground">{auditRun.overallScore}</span> / 100
                  {" · "}
                  {auditRun.issues.length} issue{auditRun.issues.length === 1 ? "" : "s"}
                </p>
                {auditRun.issues.length > 0 && (
                  <div className="flex flex-col gap-3">
                    {issueGroups.map((group) => {
                      const isCluster = group.issues.length > 1;
                      const isExpanded = !isCluster || expandedRuleIds.has(group.ruleId);
                      return (
                        <div key={group.ruleId} className="flex flex-col gap-2">
                          {isCluster && (
                            <button
                              type="button"
                              onClick={() => toggleRuleExpanded(group.ruleId)}
                              className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2 text-left text-xs text-muted-foreground hover:bg-white/10"
                            >
                              <span>
                                <span className="font-medium text-foreground">{group.ruleId}</span>
                                {" — "}
                                {group.issues.length} pages affected by the same underlying issue
                              </span>
                              <span>{isExpanded ? "Hide" : "Show"} pages</span>
                            </button>
                          )}
                          {isExpanded &&
                            group.issues.map((issue) => {
                              const fix = fixCandidates.find((candidate) => candidate.auditIssueId === issue.id);
                              return (
                                <div key={issue.id} className="flex items-start justify-between gap-3 border-b py-1">
                          <div>
                            <p>{issue.message}</p>
                            <p className="text-xs text-muted-foreground">
                              {issue.ruleId} · {issue.category}
                            </p>
                            {issue.recommendation ? (
                              <p className="mt-1 text-xs italic text-zinc-600 dark:text-muted-foreground/70">
                                {issue.recommendation}
                              </p>
                            ) : (
                              <p className="mt-1 text-xs text-muted-foreground/70">Generating recommendation…</p>
                            )}
                            {fix && (
                              <div className="mt-2 flex items-start gap-2 rounded-lg border border-white/10 bg-black/20 p-2">
                                <div className="flex-1">
                                  <p className="text-xs font-medium text-muted-foreground">
                                    {FIX_TYPE_LABEL[fix.type] ?? fix.type} fix
                                    {fix.status === "APPLIED" && <span className="ml-2 text-green-400">Applied</span>}
                                    {fix.status === "FAILED" && <span className="ml-2 text-red-400">Apply failed</span>}
                                  </p>
                                  {/* Only TITLE/META_DESCRIPTION can ever be auto-applied (see the
                                      Approve & Apply button below), and only with WordPress connected
                                      — say so plainly here too, since this box is the first thing a
                                      user sees and "Quick win" elsewhere could otherwise read as a
                                      promise this tool can't keep for H1/CANONICAL_URL fixes or
                                      without a WordPress connection. */}
                                  {fix.type === "TITLE" || fix.type === "META_DESCRIPTION" ? (
                                    !wordPressConnection && (
                                      <p className="text-xs text-muted-foreground/70">
                                        Connect WordPress to apply this automatically — for now, copy it in manually.
                                      </p>
                                    )
                                  ) : (
                                    <p className="text-xs text-muted-foreground/70">
                                      No automatic apply for this fix type yet — copy it in manually.
                                    </p>
                                  )}
                                  <p className="text-xs">{fix.content}</p>
                                  {/* META_DESCRIPTION applies to WordPress's core "excerpt" field —
                                      a real, always-writable field, but not guaranteed to be what the
                                      live page's <meta name="description"> tag actually renders (that
                                      depends on the site's theme/SEO plugin — Yoast/RankMath usually
                                      override it with their own field). Said upfront, not just after
                                      the fact, so "Applied" isn't read with TITLE's same certainty. */}
                                  {fix.type === "META_DESCRIPTION" && wordPressConnection && (
                                    <p className="mt-1 text-xs text-amber-400">
                                      Applies to WordPress&apos;s excerpt field — whether this changes your live meta
                                      description tag depends on your theme/SEO plugin.
                                    </p>
                                  )}
                                  {fixActionErrors[fix.id] && (
                                    <p className="mt-1 text-xs text-red-400">{fixActionErrors[fix.id]}</p>
                                  )}
                                </div>
                                <div className="flex flex-col items-end gap-1">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      void navigator.clipboard.writeText(fix.content);
                                      setCopiedFixId(fix.id);
                                      setTimeout(() => setCopiedFixId((id) => (id === fix.id ? null : id)), 1500);
                                    }}
                                  >
                                    {copiedFixId === fix.id ? t("copied") : t("copy")}
                                  </Button>
                                  {/* Only TITLE and META_DESCRIPTION fixes can be pushed to WordPress
                                      today — see ApplyFixCandidateUseCase's MVP scope. */}
                                  {(fix.type === "TITLE" || fix.type === "META_DESCRIPTION") && wordPressConnection && fix.status !== "APPLIED" && (
                                    <Button
                                      size="sm"
                                      disabled={fixActionPendingId === fix.id}
                                      onClick={() => handleApplyFix(fix.id)}
                                    >
                                      {fixActionPendingId === fix.id ? t("applying") : t("approveApply")}
                                    </Button>
                                  )}
                                  {(fix.type === "TITLE" || fix.type === "META_DESCRIPTION") && wordPressConnection && fix.status === "APPLIED" && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      disabled={fixActionPendingId === fix.id}
                                      onClick={() => handleRevertFix(fix.id)}
                                    >
                                      {fixActionPendingId === fix.id ? t("reverting") : t("revert")}
                                    </Button>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <Badge variant={SEVERITY_BADGE_VARIANT[issue.severity] ?? "default"}>{issue.severity}</Badge>
                            <span className="text-xs text-muted-foreground">
                              {PRIORITY_TIER_LABEL[issue.priority.tier] ?? issue.priority.tier}
                            </span>
                            <span
                              className="text-xs text-muted-foreground"
                              title={
                                issue.trafficImpact.hasTrafficData
                                  ? `${issue.trafficImpact.pageImpressions} impressions / ${issue.trafficImpact.pageClicks} clicks (last 30 days)`
                                  : "No Search Console traffic data for this page yet — ranked by severity only"
                              }
                            >
                              {issue.trafficImpact.tier} traffic impact
                              {issue.trafficImpact.hasTrafficData
                                ? ` (${issue.trafficImpact.pageImpressions} impr.)`
                                : " (no data yet)"}
                            </span>
                          </div>
                                </div>
                              );
                            })}
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            ) : (
              <p className="text-muted-foreground">No audit yet — run a crawl from the Overview tab first.</p>
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === "growth" && (
        <div className="flex flex-col gap-5">
          <Card>
            <CardHeader>
              <CardTitle>{t("cardAiVisibility")}</CardTitle>
              <CardAction>
                <Button onClick={handleRunAiVisibilityProbe} disabled={isProbingAiVisibility} size="sm">
                  {isProbingAiVisibility ? "Measuring…" : aiVisibility ? "Re-measure" : "Measure"}
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-sm">
              <p className="text-muted-foreground">
                Measures whether AI answer engines (e.g. ChatGPT) recommend your site for buyer-intent
                queries — the discovery layer no classic SEO tool sees. Enter the queries a customer might ask
                an assistant, one per line. Each is sampled several times, so this can take a minute.
              </p>
              <div className="flex flex-col gap-1">
                <Label htmlFor="ai-visibility-queries">Target queries (one per line)</Label>
                <textarea
                  id="ai-visibility-queries"
                  value={aiVisibilityQueries}
                  onChange={(e) => setAiVisibilityQueries(e.target.value)}
                  rows={4}
                  placeholder={"best prediction market platform\nTürkçe tahmin piyasası uygulaması"}
                  className="rounded-md border border-white/10 bg-black/20 p-2 font-mono text-xs"
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="ai-visibility-competitors">Known competitors (comma-separated, optional)</Label>
                <Input
                  id="ai-visibility-competitors"
                  value={aiVisibilityCompetitors}
                  onChange={(e) => setAiVisibilityCompetitors(e.target.value)}
                  placeholder="Polymarket, Kalshi, Manifold"
                />
              </div>
              {aiVisibilityError && <p className="text-red-400">{aiVisibilityError}</p>}
              {!aiVisibility && !aiVisibilityError && (
                <p className="text-muted-foreground">No probe run yet for this project.</p>
              )}
              {aiVisibility && (
                <div className="flex flex-col gap-3">
                  <div className="flex flex-wrap gap-x-4 gap-y-1">
                    <span className="text-green-400">✅ Mentioned {aiVisibility.scorecard.mentionedPct}%</span>
                    <span className="text-cyan-300">🟢 Open {aiVisibility.scorecard.openPct}%</span>
                    <span className="text-muted-foreground">⛔ Contested {aiVisibility.scorecard.contestedPct}%</span>
                    <span className="text-muted-foreground">
                      ({aiVisibility.scorecard.totalSamples} samples · {new Date(aiVisibility.runAt).toLocaleString()})
                    </span>
                  </div>
                  {aiVisibility.scorecard.competitorFrequency.length > 0 && (
                    <p className="text-muted-foreground">
                      Competitors dominating:{" "}
                      {aiVisibility.scorecard.competitorFrequency.map((c) => `${c.name} (${c.queryCount})`).join(", ")}
                    </p>
                  )}
                  {aiVisibility.scorecard.winnableQueries.length > 0 && (
                    <div>
                      <p className="text-cyan-300">Winnable queries (no incumbent yet):</p>
                      <ul className="list-disc pl-5 text-muted-foreground">
                        {aiVisibility.scorecard.winnableQueries.map((q) => (
                          <li key={q}>{q}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <div className="flex flex-col gap-1">
                    {aiVisibility.queries.map((q) => (
                      <div
                        key={q.query}
                        className="flex items-center justify-between gap-2 border-b border-white/5 py-1"
                      >
                        <span className="truncate">{q.query}</span>
                        <span className="flex items-center gap-2 whitespace-nowrap">
                          <Badge variant="outline">{q.dominantSlot}</Badge>
                          <span className="text-xs text-muted-foreground">
                            M{q.mentioned}/O{q.open}/C{q.contested}
                          </span>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Growth Analysis</CardTitle>
              <CardAction>
                <Button onClick={handleGenerateGrowthAnalysis} disabled={isGeneratingGrowthAnalysis} size="sm">
                  {isGeneratingGrowthAnalysis
                    ? "Analyzing…"
                    : growthAnalysis
                      ? "Regenerate"
                      : "Generate growth analysis"}
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-sm">
              <p className="text-muted-foreground">
                A business-growth read of your whole site — not a technical audit. Identifies missing content,
                weak conversion pages, and new pages worth writing, reasoned from your crawled pages as one
                business. LLM-generated ideas to consider, not measured search data or a traffic guarantee.
              </p>
              {growthAnalysisError && <p className="text-red-400">{growthAnalysisError}</p>}
              {!growthAnalysis && !growthAnalysisError && (
                <p className="text-muted-foreground">No analysis generated yet for this project.</p>
              )}
            </CardContent>
          </Card>

          {growthAnalysis && (
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Business Understanding</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{growthAnalysis.businessUnderstanding}</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Content Coverage Gaps</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{growthAnalysis.contentGapsSummary}</p>
                </CardContent>
              </Card>

              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle>High-Impact Content Opportunities</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-2 text-sm">
                  {[...growthAnalysis.opportunities]
                    .sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority])
                    .map((opportunity, index) => (
                      <div key={index} className="rounded-lg border border-white/10 bg-black/20 p-3">
                        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                          <span className="font-medium">{opportunity.title}</span>
                          <Badge variant={PRIORITY_BADGE_VARIANT[opportunity.priority] ?? "secondary"}>
                            {opportunity.priority}
                          </Badge>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {opportunity.pageType} · {opportunity.suggestedSlug} · Intent: {opportunity.searchIntent}
                        </p>
                        <p className="mt-1 text-xs">{opportunity.whyUsersSearch}</p>
                        <p className="mt-1 text-xs text-muted-foreground">Revenue case: {opportunity.whyRevenue}</p>
                      </div>
                    ))}
                </CardContent>
              </Card>

              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle>Conversion Opportunities on Existing Pages</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-2 text-sm">
                  {growthAnalysis.conversionOpportunities.map((item, index) => (
                    <div key={index} className="rounded-lg border border-white/10 bg-black/20 p-2">
                      <p className="truncate text-xs text-muted-foreground" title={item.pageUrl}>
                        {item.pageUrl}
                      </p>
                      <p className="text-xs">{item.recommendation}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Competitor-Like Pages Missing</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="flex flex-col gap-1 text-sm text-muted-foreground">
                    {growthAnalysis.missingCompetitorPages.map((item, index) => (
                      <li key={index}>• {item}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Next 10 Pages To Create</CardTitle>
                </CardHeader>
                <CardContent>
                  <ol className="flex flex-col gap-1 text-sm text-muted-foreground">
                    {growthAnalysis.topPages.map((item, index) => (
                      <li key={index}>
                        {index + 1}. {item}
                      </li>
                    ))}
                  </ol>
                </CardContent>
              </Card>

              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle>Executive Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm whitespace-pre-wrap">{growthAnalysis.executiveSummary}</p>
                </CardContent>
              </Card>
            </div>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Page Content Draft</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-sm">
              <p className="text-muted-foreground">
                Generate ready-to-publish content for a crawled page — a suggested title, meta description, body
                sections, and a full FAQ, in the page&apos;s own language, grounded in the page&apos;s real content.
                Turns a content gap into something you can paste straight in.
              </p>
              {pages.length === 0 ? (
                <p className="text-muted-foreground">Run a crawl from the Overview tab first.</p>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={draftPageUrl}
                    onChange={(e) => setDraftPageUrl(e.target.value)}
                    className="min-w-0 flex-1 rounded-lg border border-white/10 bg-black/20 px-2 py-1.5 text-xs"
                  >
                    <option value="">Select a page…</option>
                    {pages.map((page) => (
                      <option key={page.id} value={page.url}>
                        {page.title ? `${page.title} — ${page.url}` : page.url}
                      </option>
                    ))}
                  </select>
                  <Button
                    onClick={() => handleGenerateDraft(draftPageUrl)}
                    disabled={generatingDraft || !draftPageUrl}
                    size="sm"
                  >
                    {generatingDraft ? "Writing…" : "Generate draft"}
                  </Button>
                </div>
              )}
              {draftError && <p className="text-red-400">{draftError}</p>}
            </CardContent>
          </Card>

          {contentDrafts.map((draft) => (
            <Card key={draft.pageUrl}>
              <CardHeader>
                <CardTitle className="truncate" title={draft.pageUrl}>
                  Draft · {draft.pageUrl}
                  {draft.status === "PUBLISHED" && <span className="ml-2 text-green-400">{t("published")}</span>}
                  {draft.status === "FAILED" && <span className="ml-2 text-red-400">{t("publishFailed")}</span>}
                </CardTitle>
                <CardAction>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      void navigator.clipboard.writeText(formatDraftForCopy(draft));
                      setCopiedDraftUrl(draft.pageUrl);
                      setTimeout(() => setCopiedDraftUrl((u) => (u === draft.pageUrl ? null : u)), 1500);
                    }}
                  >
                    {copiedDraftUrl === draft.pageUrl ? t("copied") : t("copy")}
                  </Button>
                </CardAction>
              </CardHeader>
              <CardContent className="flex flex-col gap-3 text-sm">
                <div className="rounded-lg border border-white/10 bg-black/20 p-2">
                  <p className="text-xs text-muted-foreground">Title</p>
                  <p>{draft.suggestedTitle}</p>
                  <p className="mt-2 text-xs text-muted-foreground">Meta description</p>
                  <p>{draft.suggestedMetaDescription}</p>
                </div>
                {!wordPressConnection && <p className="text-xs text-muted-foreground/70">{t("draftNeedsWordPress")}</p>}
                {draftActionErrors[draft.id] && <p className="text-xs text-red-400">{draftActionErrors[draft.id]}</p>}
                {wordPressConnection && (
                  <div>
                    {draft.status !== "PUBLISHED" ? (
                      <Button
                        size="sm"
                        disabled={draftActionPendingId === draft.id}
                        onClick={() => handlePublishDraft(draft.id)}
                      >
                        {draftActionPendingId === draft.id ? t("publishing") : t("publish")}
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={draftActionPendingId === draft.id}
                        onClick={() => handleRevertDraft(draft.id)}
                      >
                        {draftActionPendingId === draft.id ? t("reverting") : t("revert")}
                      </Button>
                    )}
                  </div>
                )}
                {draft.bodySections.map((section, index) => (
                  <div key={index}>
                    <p className="font-medium">{section.heading}</p>
                    <p className="text-muted-foreground whitespace-pre-wrap">{section.content}</p>
                  </div>
                ))}
                {draft.faqs.length > 0 && (
                  <div className="flex flex-col gap-2">
                    <p className="font-medium">FAQ</p>
                    {draft.faqs.map((faq, index) => (
                      <div key={index} className="rounded-lg border border-white/10 bg-black/20 p-2">
                        <p className="text-xs font-medium">{faq.question}</p>
                        <p className="text-xs text-muted-foreground">{faq.answer}</p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {activeTab === "integrations" && (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>{t("cardWordPress")}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-sm">
              {wordPressConnection ? (
                <>
                  <p className="text-muted-foreground">
                    Connected to <span className="font-medium text-foreground">{wordPressConnection.siteUrl}</span> as{" "}
                    {wordPressConnection.username}
                  </p>
                  <Button
                    variant="outline"
                    className="self-start"
                    onClick={handleDisconnectWordPress}
                    disabled={isDisconnectingWordPress}
                  >
                    {isDisconnectingWordPress ? t("disconnecting") : t("disconnect")}
                  </Button>
                </>
              ) : (
                <form onSubmit={handleConnectWordPress} className="flex flex-col gap-3">
                  <p className="text-muted-foreground">
                    Connect a WordPress site to apply title and meta description fixes directly — generate an{" "}
                    <span className="font-medium">Application Password</span> from your WordPress admin (Users → Profile)
                    and paste it below. Other fix types stay copy-paste only for now.
                  </p>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="wp-site-url">Site URL</Label>
                    <Input
                      id="wp-site-url"
                      value={wpSiteUrl}
                      onChange={(e) => setWpSiteUrl(e.target.value)}
                      placeholder="https://example.com"
                      required
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="wp-username">Username</Label>
                    <Input id="wp-username" value={wpUsername} onChange={(e) => setWpUsername(e.target.value)} required />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="wp-app-password">Application password</Label>
                    <Input
                      id="wp-app-password"
                      type="password"
                      value={wpApplicationPassword}
                      onChange={(e) => setWpApplicationPassword(e.target.value)}
                      required
                    />
                  </div>
                  {wordPressError && <p className="text-red-400">{wordPressError}</p>}
                  <Button type="submit" disabled={isConnectingWordPress} className="self-start">
                    {isConnectingWordPress ? t("connecting") : t("connect")}
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("cardAutoPilot")}</CardTitle>
              <CardAction>
                <Badge variant={project.autoPilotEnabled ? "default" : "secondary"}>
                  {project.autoPilotEnabled ? t("autoPilotOn") : t("autoPilotOff")}
                </Badge>
              </CardAction>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-sm">
              <p className="text-muted-foreground">{t("autoPilotDescription")}</p>
              {!wordPressConnection && <p className="text-muted-foreground">{t("autoPilotNoWordPress")}</p>}
              <Button
                variant={project.autoPilotEnabled ? "outline" : "default"}
                className="self-start"
                onClick={handleToggleAutoPilot}
                disabled={isUpdatingAutoPilot}
              >
                {isUpdatingAutoPilot
                  ? t("autoPilotUpdating")
                  : project.autoPilotEnabled
                    ? t("autoPilotOff")
                    : t("autoPilotOn")}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("cardSearchPerformance")}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 text-sm">
              {!googleStatus.connected ? (
                <>
                  <p className="text-muted-foreground">
                    Connect a Google account to pull Search Console rankings and GA4 organic traffic into this dashboard —
                    read-only, never writes anything to your Google account.
                  </p>
                  <Button onClick={handleConnectGoogle} disabled={isConnectingGoogle} className="self-start">
                    {isConnectingGoogle ? "Waiting for authorization…" : "Connect Google Account"}
                  </Button>
                  {googleError && <p className="text-red-400">{googleError}</p>}
                </>
              ) : (
                <>
                  {!googleStatus.gscSiteUrl ? (
                    googleStatus.availableSites && googleStatus.availableSites.length > 0 ? (
                      <div className="flex flex-col gap-2">
                        <p className="text-muted-foreground">Pick the Search Console property for this site:</p>
                        {googleStatus.availableSites.map((site) => (
                          <Button key={site} variant="outline" size="sm" className="self-start" onClick={() => handleSelectGscSite(site)}>
                            {site}
                          </Button>
                        ))}
                      </div>
                    ) : (
                      <p className="text-muted-foreground">
                        No Search Console properties found for this Google account — add and verify this site in Search
                        Console first.
                      </p>
                    )
                  ) : (
                    <p className="text-muted-foreground">
                      Search Console: <span className="font-medium text-foreground">{googleStatus.gscSiteUrl}</span>
                    </p>
                  )}

                  {searchPerformance.length > 0 && (
                    <table className="w-full text-left text-xs">
                      <thead className="text-muted-foreground">
                        <tr>
                          <th className="py-1">Date</th>
                          <th className="py-1">Clicks</th>
                          <th className="py-1">Impressions</th>
                          <th className="py-1">CTR</th>
                          <th className="py-1">Avg. position</th>
                        </tr>
                      </thead>
                      <tbody>
                        {searchPerformance.slice(0, 14).map((row) => (
                          <tr key={row.date} className="border-t">
                            <td className="py-1">{row.date}</td>
                            <td className="py-1">{row.clicks}</td>
                            <td className="py-1">{row.impressions}</td>
                            <td className="py-1">{(row.ctr * 100).toFixed(1)}%</td>
                            <td className="py-1">{row.position.toFixed(1)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}

                  <form onSubmit={handleSaveGa4Property} className="flex flex-col gap-2">
                    <Label htmlFor="ga4-property-id">GA4 Property ID (optional, for organic traffic)</Label>
                    <div className="flex gap-2">
                      <Input
                        id="ga4-property-id"
                        value={ga4PropertyIdInput}
                        onChange={(e) => setGa4PropertyIdInput(e.target.value)}
                        placeholder="e.g. 501234567"
                      />
                      <Button type="submit" variant="outline">
                        Save
                      </Button>
                    </div>
                  </form>

                  {analyticsSnapshots.length > 0 && (
                    <table className="w-full text-left text-xs">
                      <thead className="text-muted-foreground">
                        <tr>
                          <th className="py-1">Date</th>
                          <th className="py-1">Organic sessions</th>
                          <th className="py-1">Conversions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {analyticsSnapshots.slice(0, 14).map((row) => (
                          <tr key={row.date} className="border-t">
                            <td className="py-1">{row.date}</td>
                            <td className="py-1">{row.organicSessions}</td>
                            <td className="py-1">{row.conversions}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}

                  <label className="flex items-center gap-2 text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={googleStatus.autoRefreshEnabled}
                      onChange={(e) => handleToggleAutoRefresh(e.target.checked)}
                    />
                    Auto-refresh daily while Seos is open
                  </label>

                  <div className="flex gap-2">
                    <Button onClick={handleRefreshGoogleTracking} disabled={isRefreshingGoogle} variant="outline" size="sm">
                      {isRefreshingGoogle ? "Refreshing…" : "Refresh now"}
                    </Button>
                    <Button onClick={handleDisconnectGoogle} disabled={isDisconnectingGoogle} variant="outline" size="sm">
                      {isDisconnectingGoogle ? t("disconnecting") : t("disconnect")}
                    </Button>
                  </div>
                  {googleError && <p className="text-red-400">{googleError}</p>}
                </>
              )}
            </CardContent>
          </Card>

          {keywordOpportunities.length > 0 && (
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>Keyword Opportunities</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3 text-sm">
                <p className="text-muted-foreground">
                  Pages already ranking on Google but not yet on page 1 — the highest-ROI targets for a content
                  improvement, since relevance is already established.
                </p>
                <div className="flex flex-col gap-2">
                  {keywordOpportunities.map((row) => (
                    <div key={row.id} className="rounded-lg border border-white/10 bg-black/20 p-2">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                        <span className="text-xs font-medium">{row.query}</span>
                        <span className="text-xs text-muted-foreground">
                          Position {row.position.toFixed(1)} · {row.impressions} impressions · {row.clicks} clicks
                        </span>
                      </div>
                      <p className="truncate text-xs text-muted-foreground" title={row.pageUrl}>
                        {row.pageUrl}
                      </p>

                      {row.suggestion ? (
                        <div className="mt-2 flex items-start gap-2 rounded-lg border border-white/10 bg-black/20 p-2">
                          <p className="flex-1 text-xs">{row.suggestion}</p>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              void navigator.clipboard.writeText(row.suggestion ?? "");
                              setCopiedSuggestionId(row.id);
                              setTimeout(() => setCopiedSuggestionId((id) => (id === row.id ? null : id)), 1500);
                            }}
                          >
                            {copiedSuggestionId === row.id ? t("copied") : t("copy")}
                          </Button>
                        </div>
                      ) : (
                        <div className="mt-2">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={generatingSuggestionId === row.id}
                            onClick={() => handleGenerateSuggestion(row.id)}
                          >
                            {generatingSuggestionId === row.id ? "Generating…" : "Generate content suggestion"}
                          </Button>
                          {suggestionError[row.id] && <p className="mt-1 text-xs text-red-400">{suggestionError[row.id]}</p>}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {keywordCannibalization.length > 0 && (
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>Keyword Cannibalization</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3 text-sm">
                <p className="text-muted-foreground">
                  Two or more pages competing for the same query split (and likely suppress) each other&apos;s ranking
                  — consider consolidating them or differentiating their targeting.
                </p>
                <div className="flex flex-col gap-2">
                  {keywordCannibalization.map((issue) => (
                    <div key={issue.id} className="rounded-lg border border-white/10 bg-black/20 p-2">
                      <span className="text-xs font-medium">{issue.query}</span>
                      <div className="mt-1 flex flex-col gap-1">
                        {issue.pages.map((page) => (
                          <div key={page.pageUrl} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                            <p className="truncate text-xs text-muted-foreground" title={page.pageUrl}>
                              {page.pageUrl}
                            </p>
                            <span className="shrink-0 text-xs text-muted-foreground">
                              Position {page.position.toFixed(1)} · {page.impressions} impressions
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {ctrUnderperformers.length > 0 && (
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>CTR Underperformers</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3 text-sm">
                <p className="text-muted-foreground">
                  These pages rank well but get far fewer clicks than this site&apos;s own average at that rank — the
                  ranking is fine, the title or meta description in the snippet isn&apos;t earning the clicks it should.
                </p>
                <div className="flex flex-col gap-2">
                  {ctrUnderperformers.map((issue) => (
                    <div key={issue.id} className="rounded-lg border border-white/10 bg-black/20 p-2">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                        <span className="text-xs font-medium">{issue.query}</span>
                        <span className="text-xs text-muted-foreground">
                          Position {issue.position.toFixed(1)} · {(issue.ctr * 100).toFixed(1)}% CTR vs.{" "}
                          {(issue.expectedCtr * 100).toFixed(1)}% expected
                        </span>
                      </div>
                      <p className="truncate text-xs text-muted-foreground" title={issue.pageUrl}>
                        {issue.pageUrl}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {activeTab === "outputs" && (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {robots && (
            <Card>
              <CardHeader>
                <CardTitle>{t("cardRobots")}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3 text-sm">
                <p className="text-muted-foreground">generated {new Date(robots.generatedAt).toLocaleString()}</p>
                <Button variant="outline" className="self-start" onClick={() => setShowRobotsTxt((v) => !v)}>
                  {showRobotsTxt ? "Hide" : "View"} robots.txt
                </Button>
                {showRobotsTxt && (
                  <pre className="overflow-x-auto rounded-lg border border-white/10 bg-black/20 p-3 text-xs">
                    {robots.content}
                  </pre>
                )}
              </CardContent>
            </Card>
          )}

          {schemaMarkup.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>{t("cardSchema")}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3 text-sm">
                <p className="text-muted-foreground">
                  {schemaMarkup.length} JSON-LD block{schemaMarkup.length === 1 ? "" : "s"} generated
                </p>
                <div className="flex flex-col gap-2">
                  {schemaMarkup.map((markup) => (
                    <div key={markup.id} className="flex flex-col gap-2 border-b py-1">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-medium">{markup.type}</p>
                          <p className="text-xs text-muted-foreground">{SOURCE_LABEL[markup.source] ?? markup.source}</p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setExpandedSchemaId((id) => (id === markup.id ? null : markup.id))}
                        >
                          {expandedSchemaId === markup.id ? "Hide" : "View"} JSON-LD
                        </Button>
                      </div>
                      {expandedSchemaId === markup.id && (
                        <pre className="overflow-x-auto rounded-lg border border-white/10 bg-black/20 p-3 text-xs">
                          {JSON.stringify(markup.jsonLd, null, 2)}
                        </pre>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {sitemap && (
            <Card>
              <CardHeader>
                <CardTitle>{t("cardSitemap")}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3 text-sm">
                <p className="text-muted-foreground">
                  {sitemap.pageCount} URL{sitemap.pageCount === 1 ? "" : "s"}
                  {" · "}
                  generated {new Date(sitemap.generatedAt).toLocaleString()}
                </p>
                <Button variant="outline" className="self-start" onClick={() => setShowSitemapXml((v) => !v)}>
                  {showSitemapXml ? "Hide" : "View"} sitemap.xml
                </Button>
                {showSitemapXml && (
                  <pre className="overflow-x-auto rounded-lg border border-white/10 bg-black/20 p-3 text-xs">
                    {sitemap.content}
                  </pre>
                )}
              </CardContent>
            </Card>
          )}

          {llmsTxt && (
            <Card>
              <CardHeader>
                <CardTitle>{t("cardLlmsTxt")}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3 text-sm">
                <p className="text-muted-foreground">
                  {llmsTxt.pageCount} page{llmsTxt.pageCount === 1 ? "" : "s"} listed
                  {" · "}
                  generated {new Date(llmsTxt.generatedAt).toLocaleString()}
                </p>
                <Button variant="outline" className="self-start" onClick={() => setShowLlmsTxt((v) => !v)}>
                  {showLlmsTxt ? "Hide" : "View"} llms.txt
                </Button>
                {showLlmsTxt && (
                  <pre className="overflow-x-auto rounded-lg border border-white/10 bg-black/20 p-3 text-xs">
                    {llmsTxt.content}
                  </pre>
                )}
              </CardContent>
            </Card>
          )}

          {!robots && !sitemap && schemaMarkup.length === 0 && !llmsTxt && (
            <Card className="md:col-span-2">
              <CardContent className="pt-5 text-sm text-muted-foreground">
                Nothing generated yet — these appear automatically once a crawl completes.
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
