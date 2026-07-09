import { useEffect, useState } from "react";
import type {
  AiVisibilityRunDto,
  AiVisibilityTrendPointDto,
  VisibilityExperimentDto,
  MultiEngineComparisonDto,
} from "@/application/ai-visibility/dto";
import type { CitationDraft } from "@/application/ai-visibility/ports/ai-visibility-model-port";
import type { TranslationKey } from "../shared";

function citationDraftToText(draft: CitationDraft): string {
  const parts: string[] = [draft.title, "", draft.metaDescription, ""];
  for (const s of draft.sections) parts.push(`## ${s.heading}`, s.body, "");
  if (draft.faqs.length > 0) {
    parts.push("## FAQ");
    for (const f of draft.faqs) parts.push(`Q: ${f.question}`, `A: ${f.answer}`, "");
  }
  return parts.join("\n");
}

export function engineLabel(engine: string): string {
  const labels: Record<string, string> = {
    openai: "ChatGPT",
    anthropic: "Claude",
    deepseek: "DeepSeek",
    gemini: "Gemini",
  };
  return labels[engine] ?? engine;
}

export function experimentOutcomeClass(outcome: string | null): string {
  return outcome === "IMPROVED"
    ? "text-green-400"
    : outcome === "REGRESSED"
      ? "text-red-400"
      : "text-muted-foreground";
}

// Owns the whole AI Visibility feature: running the probe (measuring
// whether AI answer engines recommend the site for a set of queries),
// comparing multiple engines side by side, diagnosing why a query is
// lost, drafting and publishing citation content to close that gap, and
// tracking the resulting visibility experiments over time.
export function useAiVisibility(projectId: string, t: (key: TranslationKey) => string) {
  const [aiVisibility, setAiVisibility] = useState<AiVisibilityRunDto | null>(null);
  const [aiVisibilityTrend, setAiVisibilityTrend] = useState<AiVisibilityTrendPointDto[]>([]);
  const [isProbingAiVisibility, setIsProbingAiVisibility] = useState(false);
  const [engineComparison, setEngineComparison] = useState<MultiEngineComparisonDto | null>(null);
  const [isComparingEngines, setIsComparingEngines] = useState(false);
  const [isSuggestingQueries, setIsSuggestingQueries] = useState(false);
  const [aiVisibilityError, setAiVisibilityError] = useState<string | null>(null);
  const [aiVisibilityQueries, setAiVisibilityQueries] = useState("");
  const [aiVisibilityCompetitors, setAiVisibilityCompetitors] = useState("");
  // Default to the real AI-search surface (web-grounded); the toggle lets a
  // user fall back to the cheap memory-only reading.
  const [aiVisibilityWebGrounded, setAiVisibilityWebGrounded] = useState(true);
  const [diagnosingQuery, setDiagnosingQuery] = useState<string | null>(null);
  const [diagnoses, setDiagnoses] = useState<Record<string, string[]>>({});
  const [diagnoseErrors, setDiagnoseErrors] = useState<Record<string, string>>({});
  const [isBuildingFixPlan, setIsBuildingFixPlan] = useState(false);
  const [fixPlanError, setFixPlanError] = useState<string | null>(null);
  const [draftingQuery, setDraftingQuery] = useState<string | null>(null);
  const [citationDrafts, setCitationDrafts] = useState<Record<string, CitationDraft>>({});
  const [draftGapErrors, setDraftGapErrors] = useState<Record<string, string>>({});
  const [copiedDraftQuery, setCopiedDraftQuery] = useState<string | null>(null);
  const [publishingCitationQuery, setPublishingCitationQuery] = useState<string | null>(null);
  const [citationPublishErrors, setCitationPublishErrors] = useState<Record<string, string>>({});
  const [citationPublishedQueries, setCitationPublishedQueries] = useState<Record<string, boolean>>({});
  const [experiments, setExperiments] = useState<VisibilityExperimentDto[]>([]);
  const [copiedAiVisibilityReport, setCopiedAiVisibilityReport] = useState(false);

  // Latest stored AI-visibility probe, if any — read-only on mount. A
  // fresh probe is only run when the user clicks Measure (a real,
  // multi-call LLM cost).
  useEffect(() => {
    fetch(`/api/v1/projects/${projectId}/ai-visibility`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data: AiVisibilityRunDto | null) => setAiVisibility(data))
      .catch((error: unknown) => console.error("Failed to fetch AI visibility run", error));
    fetch(`/api/v1/projects/${projectId}/ai-visibility/experiments`)
      .then((response) => (response.ok ? response.json() : []))
      .then((data: VisibilityExperimentDto[]) => setExperiments(data))
      .catch((error: unknown) => console.error("Failed to fetch visibility experiments", error));
    fetch(`/api/v1/projects/${projectId}/ai-visibility/trend`)
      .then((response) => (response.ok ? response.json() : []))
      .then((data: AiVisibilityTrendPointDto[]) => setAiVisibilityTrend(data))
      .catch((error: unknown) => console.error("Failed to fetch AI visibility trend", error));
  }, [projectId]);

  function refreshAiVisibilityExperiments() {
    fetch(`/api/v1/projects/${projectId}/ai-visibility/experiments`)
      .then((response) => (response.ok ? response.json() : []))
      .then((data: VisibilityExperimentDto[]) => setExperiments(data))
      .catch((error: unknown) => console.error("Failed to fetch visibility experiments", error));
  }

  async function handleSuggestAiVisibilityQueries() {
    setIsSuggestingQueries(true);
    setAiVisibilityError(null);

    let response: Response;
    try {
      response = await fetch(`/api/v1/projects/${projectId}/ai-visibility/suggest`, { method: "POST" });
    } catch {
      setIsSuggestingQueries(false);
      setAiVisibilityError(t("networkErrorRetry"));
      return;
    }
    const data = await response.json();

    setIsSuggestingQueries(false);
    if (!response.ok) {
      setAiVisibilityError(data.error ?? t("failedToSuggestQueries"));
      return;
    }
    setAiVisibilityQueries((data.queries ?? []).join("\n"));
    setAiVisibilityCompetitors((data.competitors ?? []).join(", "));
  }

  async function handleDiagnoseGap(query: string) {
    setDiagnosingQuery(query);
    setDiagnoseErrors((prev) => ({ ...prev, [query]: "" }));

    let response: Response;
    try {
      response = await fetch(`/api/v1/projects/${projectId}/ai-visibility/diagnose`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query }),
      });
    } catch {
      setDiagnosingQuery(null);
      setDiagnoseErrors((prev) => ({ ...prev, [query]: t("networkErrorTryAgain") }));
      return;
    }
    const data = await response.json();

    setDiagnosingQuery(null);
    if (!response.ok) {
      setDiagnoseErrors((prev) => ({ ...prev, [query]: data.error ?? t("failedToDiagnose") }));
      return;
    }
    setDiagnoses((prev) => ({ ...prev, [query]: data.gaps ?? [] }));
  }

  async function handleGenerateCitationDraft(query: string) {
    setDraftingQuery(query);
    setDraftGapErrors((prev) => ({ ...prev, [query]: "" }));

    let response: Response;
    try {
      response = await fetch(`/api/v1/projects/${projectId}/ai-visibility/draft`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query, gaps: diagnoses[query] ?? [] }),
      });
    } catch {
      setDraftingQuery(null);
      setDraftGapErrors((prev) => ({ ...prev, [query]: t("networkErrorTryAgain") }));
      return;
    }
    const data = await response.json();

    setDraftingQuery(null);
    if (!response.ok) {
      setDraftGapErrors((prev) => ({ ...prev, [query]: data.error ?? t("failedToDraftContent") }));
      return;
    }
    setCitationDrafts((prev) => ({ ...prev, [query]: data }));
    // Drafting opened a tracking experiment server-side — reflect it.
    refreshAiVisibilityExperiments();
  }

  async function handleCopyCitationDraft(query: string) {
    const draft = citationDrafts[query];
    if (!draft) return;
    await navigator.clipboard.writeText(citationDraftToText(draft));
    setCopiedDraftQuery(query);
    setTimeout(() => setCopiedDraftQuery(null), 2000);
  }

  async function handlePublishCitationDraft(query: string) {
    const draft = citationDrafts[query];
    if (!draft) return;

    setPublishingCitationQuery(query);
    setCitationPublishErrors((prev) => ({ ...prev, [query]: "" }));

    let response: Response;
    try {
      response = await fetch(`/api/v1/projects/${projectId}/ai-visibility/publish`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        // Pass the query so the server opens the visibility experiment on this
        // real publish (the act), not on drafting.
        body: JSON.stringify({ draft, query }),
      });
    } catch {
      setPublishingCitationQuery(null);
      setCitationPublishErrors((prev) => ({ ...prev, [query]: t("networkErrorRetry") }));
      return;
    }
    const data = await response.json();

    setPublishingCitationQuery(null);
    if (!response.ok) {
      setCitationPublishErrors((prev) => ({ ...prev, [query]: data.error ?? t("failedToPublishToWordPress") }));
      return;
    }
    setCitationPublishedQueries((prev) => ({ ...prev, [query]: true }));
  }

  // Automated middle of the loop: fetch a fix plan (diagnose + generate already
  // run server-side for the winnable queries) and hydrate the per-query
  // diagnosis + draft state, so the existing "Approve & publish" gate on each
  // query row becomes the single approval step for the whole plan.
  async function handleBuildFixPlan() {
    setIsBuildingFixPlan(true);
    setFixPlanError(null);

    let response: Response;
    try {
      response = await fetch(`/api/v1/projects/${projectId}/ai-visibility/fix-plan`, { method: "POST" });
    } catch {
      setIsBuildingFixPlan(false);
      setFixPlanError(t("networkErrorRetry"));
      return;
    }
    const data = await response.json();
    setIsBuildingFixPlan(false);
    if (!response.ok) {
      setFixPlanError(data.error ?? t("failedToBuildFixPlan"));
      return;
    }
    if (data.noGroundedRun) {
      setFixPlanError(t("runWebSearchMeasurementFirst"));
      return;
    }
    const items = (data.items ?? []) as { query: string; gaps: string[]; draft: CitationDraft }[];
    if (items.length === 0) {
      setFixPlanError(t("noWinnableQueriesToplanFor"));
      return;
    }
    setDiagnoses((prev) => {
      const next = { ...prev };
      for (const item of items) next[item.query] = item.gaps;
      return next;
    });
    setCitationDrafts((prev) => {
      const next = { ...prev };
      for (const item of items) next[item.query] = item.draft;
      return next;
    });
  }

  // Measure on every configured engine at once and show them side by side.
  async function handleCompareEngines() {
    const queries = aiVisibilityQueries.split("\n").map((q) => q.trim()).filter((q) => q.length > 0);
    if (queries.length === 0) {
      setAiVisibilityError(t("enterAtLeastOneTargetQuery"));
      return;
    }
    const competitors = aiVisibilityCompetitors.split(",").map((c) => c.trim()).filter((c) => c.length > 0);

    setIsComparingEngines(true);
    setAiVisibilityError(null);
    let response: Response;
    try {
      response = await fetch(`/api/v1/projects/${projectId}/ai-visibility/multi-engine`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ queries, competitors, groundingMode: aiVisibilityWebGrounded ? "web_grounded" : "parametric" }),
      });
    } catch {
      setIsComparingEngines(false);
      setAiVisibilityError(t("networkErrorRetry"));
      return;
    }
    const data = await response.json();
    setIsComparingEngines(false);
    if (!response.ok) {
      setAiVisibilityError(data.error ?? t("failedToRunMultiEngineComparison"));
      return;
    }
    setEngineComparison(data as MultiEngineComparisonDto);
  }

  async function handleRunAiVisibilityProbe() {
    const queries = aiVisibilityQueries
      .split("\n")
      .map((q) => q.trim())
      .filter((q) => q.length > 0);
    if (queries.length === 0) {
      setAiVisibilityError(t("enterAtLeastOneTargetQuery"));
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
      response = await fetch(`/api/v1/projects/${projectId}/ai-visibility`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          queries,
          competitors,
          groundingMode: aiVisibilityWebGrounded ? "web_grounded" : "parametric",
        }),
      });
    } catch {
      setIsProbingAiVisibility(false);
      setAiVisibilityError(t("networkErrorRetry"));
      return;
    }
    const data = await response.json();

    setIsProbingAiVisibility(false);
    if (!response.ok) {
      setAiVisibilityError(data.error ?? t("failedToRunAiVisibilityProbe"));
      return;
    }
    setAiVisibility(data);
    // A fresh probe may have resolved open experiments — reflect outcomes.
    refreshAiVisibilityExperiments();
    fetch(`/api/v1/projects/${projectId}/ai-visibility/trend`)
      .then((response) => (response.ok ? response.json() : []))
      .then((trendData: AiVisibilityTrendPointDto[]) => setAiVisibilityTrend(trendData))
      .catch((error: unknown) => console.error("Failed to fetch AI visibility trend", error));
  }

  return {
    aiVisibility,
    aiVisibilityTrend,
    isProbingAiVisibility,
    engineComparison,
    isComparingEngines,
    isSuggestingQueries,
    aiVisibilityError,
    aiVisibilityQueries,
    setAiVisibilityQueries,
    aiVisibilityCompetitors,
    setAiVisibilityCompetitors,
    aiVisibilityWebGrounded,
    setAiVisibilityWebGrounded,
    diagnosingQuery,
    diagnoses,
    diagnoseErrors,
    isBuildingFixPlan,
    fixPlanError,
    draftingQuery,
    citationDrafts,
    draftGapErrors,
    copiedDraftQuery,
    publishingCitationQuery,
    citationPublishErrors,
    citationPublishedQueries,
    experiments,
    copiedAiVisibilityReport,
    setCopiedAiVisibilityReport,
    handleSuggestAiVisibilityQueries,
    handleDiagnoseGap,
    handleGenerateCitationDraft,
    handleCopyCitationDraft,
    handlePublishCitationDraft,
    handleBuildFixPlan,
    handleCompareEngines,
    handleRunAiVisibilityProbe,
  };
}
