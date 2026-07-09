import { useEffect, useState } from "react";
import type { ContentIdeaDto, GrowthAnalysisDto, PageContentDraftDto } from "@/application/content-enrichment/dto";
import type { TranslationKey } from "../shared";

export { formatDraftForCopy } from "@/lib/format-content-draft";

// Owns the three content-generation tools that don't depend on Google or
// AI-visibility being set up — content ideas (new-page suggestions from
// the crawl), the whole-site growth analysis report, and page content
// drafts (generate/publish/revert full ready-to-publish page content).
export function useContentTools(projectId: string, t: (key: TranslationKey) => string) {
  const [contentIdeas, setContentIdeas] = useState<ContentIdeaDto[]>([]);
  const [isGeneratingContentIdeas, setIsGeneratingContentIdeas] = useState(false);
  const [contentIdeasError, setContentIdeasError] = useState<string | null>(null);
  const [copiedContentIdeaId, setCopiedContentIdeaId] = useState<string | null>(null);

  const [growthAnalysis, setGrowthAnalysis] = useState<GrowthAnalysisDto | null>(null);
  const [isGeneratingGrowthAnalysis, setIsGeneratingGrowthAnalysis] = useState(false);
  const [growthAnalysisError, setGrowthAnalysisError] = useState<string | null>(null);

  const [contentDrafts, setContentDrafts] = useState<PageContentDraftDto[]>([]);
  const [draftPageUrl, setDraftPageUrl] = useState("");
  const [generatingDraft, setGeneratingDraft] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [copiedDraftUrl, setCopiedDraftUrl] = useState<string | null>(null);
  const [draftActionPendingId, setDraftActionPendingId] = useState<string | null>(null);
  const [draftActionErrors, setDraftActionErrors] = useState<Record<string, string>>({});

  // Content ideas have no dependency on Google being connected — they
  // come from the crawl's own page titles/H1s — so they're fetched
  // unconditionally on mount. An empty result just means nobody has
  // clicked "Generate content ideas" yet (or there's no crawl to derive
  // them from).
  useEffect(() => {
    fetch(`/api/v1/projects/${projectId}/content-ideas`)
      .then((response) => (response.ok ? response.json() : []))
      .then((data: ContentIdeaDto[]) => setContentIdeas(data))
      .catch((error: unknown) => console.error("Failed to fetch content ideas", error));
  }, [projectId]);

  // Same reasoning as content ideas above — a business-growth report has
  // no dependency on Google being connected, it's derived purely from the
  // crawl, so it's fetched unconditionally on mount.
  useEffect(() => {
    fetch(`/api/v1/projects/${projectId}/growth-analysis`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data: GrowthAnalysisDto | null) => setGrowthAnalysis(data))
      .catch((error: unknown) => console.error("Failed to fetch growth analysis", error));
  }, [projectId]);

  useEffect(() => {
    fetch(`/api/v1/projects/${projectId}/content-draft`)
      .then((response) => (response.ok ? response.json() : []))
      .then((data: PageContentDraftDto[]) => setContentDrafts(data))
      .catch((error: unknown) => console.error("Failed to fetch content drafts", error));
  }, [projectId]);

  async function handleGenerateContentIdeas() {
    setIsGeneratingContentIdeas(true);
    setContentIdeasError(null);

    let response: Response;
    try {
      response = await fetch(`/api/v1/projects/${projectId}/content-ideas`, { method: "POST" });
    } catch {
      setIsGeneratingContentIdeas(false);
      setContentIdeasError(t("networkErrorRetry"));
      return;
    }
    const data = await response.json();

    setIsGeneratingContentIdeas(false);
    if (!response.ok) {
      setContentIdeasError(data.error ?? t("failedToGenerateContentIdeas"));
      return;
    }

    setContentIdeas(data);
  }

  async function handleGenerateGrowthAnalysis() {
    setIsGeneratingGrowthAnalysis(true);
    setGrowthAnalysisError(null);

    let response: Response;
    try {
      response = await fetch(`/api/v1/projects/${projectId}/growth-analysis`, { method: "POST" });
    } catch {
      setIsGeneratingGrowthAnalysis(false);
      setGrowthAnalysisError(t("networkErrorRetry"));
      return;
    }
    const data = await response.json();

    setIsGeneratingGrowthAnalysis(false);
    if (!response.ok) {
      setGrowthAnalysisError(data.error ?? t("failedToGenerateGrowthAnalysis"));
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
      response = await fetch(`/api/v1/projects/${projectId}/content-draft`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pageUrl }),
      });
    } catch {
      setGeneratingDraft(false);
      setDraftError(t("networkErrorRetry"));
      return;
    }
    const data = await response.json();

    setGeneratingDraft(false);
    if (!response.ok) {
      setDraftError(data.error ?? t("failedToGenerateContentDraft"));
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
      response = await fetch(`/api/v1/projects/${projectId}/content-draft/${draftId}/publish`, { method: "POST" });
    } catch {
      setDraftActionPendingId(null);
      setDraftActionErrors((errors) => ({ ...errors, [draftId]: t("networkErrorRetry") }));
      return;
    }
    const data = await response.json();

    setDraftActionPendingId(null);
    if (!response.ok) {
      setDraftActionErrors((errors) => ({ ...errors, [draftId]: data.error ?? t("failedToPublishDraft") }));
      return;
    }

    setContentDrafts((drafts) => drafts.map((draft) => (draft.id === draftId ? data : draft)));
  }

  async function handleRevertDraft(draftId: string) {
    setDraftActionPendingId(draftId);
    setDraftActionErrors((errors) => ({ ...errors, [draftId]: "" }));

    let response: Response;
    try {
      response = await fetch(`/api/v1/projects/${projectId}/content-draft/${draftId}/revert`, { method: "POST" });
    } catch {
      setDraftActionPendingId(null);
      setDraftActionErrors((errors) => ({ ...errors, [draftId]: t("networkErrorRetry") }));
      return;
    }
    const data = await response.json();

    setDraftActionPendingId(null);
    if (!response.ok) {
      setDraftActionErrors((errors) => ({ ...errors, [draftId]: data.error ?? t("failedToRevertDraft") }));
      return;
    }

    setContentDrafts((drafts) => drafts.map((draft) => (draft.id === draftId ? data : draft)));
  }

  return {
    contentIdeas,
    isGeneratingContentIdeas,
    contentIdeasError,
    copiedContentIdeaId,
    setCopiedContentIdeaId,
    growthAnalysis,
    isGeneratingGrowthAnalysis,
    growthAnalysisError,
    contentDrafts,
    draftPageUrl,
    setDraftPageUrl,
    generatingDraft,
    draftError,
    copiedDraftUrl,
    setCopiedDraftUrl,
    draftActionPendingId,
    draftActionErrors,
    handleGenerateContentIdeas,
    handleGenerateGrowthAnalysis,
    handleGenerateDraft,
    handlePublishDraft,
    handleRevertDraft,
  };
}
