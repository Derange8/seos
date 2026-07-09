import { useEffect, useState } from "react";
import type {
  SearchPerformanceSnapshotDto,
  AnalyticsSnapshotDto,
  KeywordCannibalizationIssueDto,
  CtrUnderperformerDto,
} from "@/application/tracking/dto";
import { type GoogleStatusDto, type KeywordOpportunityRow, type TranslationKey } from "../shared";

// Owns the Google Search Console / Analytics connection and everything
// derived from it: connection status, the OAuth round trip (opened in the
// system browser, polled for completion), GSC property selection, GA4
// property id, the tracking snapshots, and the three real-data reports
// (keyword opportunities, cannibalization, CTR underperformers) that only
// exist once Google is connected.
export function useGoogleIntegration(projectId: string, t: (key: TranslationKey) => string) {
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

  // Same independence from crawl state as WordPress. Snapshots are
  // fetched separately from connection status (a plain GET of whatever's
  // already stored, not a live Google call) so reloading the dashboard
  // doesn't lose previously fetched tracking data.
  useEffect(() => {
    fetch(`/api/v1/projects/${projectId}/google`)
      .then((response) => (response.ok ? response.json() : { connected: false }))
      .then((data: GoogleStatusDto) => {
        setGoogleStatus(data);
        if (data.connected && data.ga4PropertyId) setGa4PropertyIdInput(data.ga4PropertyId);
      })
      .catch((error: unknown) => console.error("Failed to fetch Google connection status", error));

    fetch(`/api/v1/projects/${projectId}/google/snapshots`)
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
  }, [projectId]);

  // Longer/slower bound than the crawl/audit poll — that one is tuned for
  // fast server-side async work (a few seconds), but this poll is waiting
  // on a human to actually click through Google's consent screen in a
  // separate browser tab, which can reasonably take a minute or two.
  async function pollForGoogleConnection() {
    for (let attempt = 0; attempt < 90; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      try {
        const response = await fetch(`/api/v1/projects/${projectId}/google`);
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
    setGoogleError(t("timedOutWaitingForGoogleAuth"));
  }

  async function handleConnectGoogle() {
    setIsConnectingGoogle(true);
    setGoogleError(null);

    let response: Response;
    try {
      response = await fetch(`/api/v1/projects/${projectId}/google/connect`, { method: "POST" });
    } catch {
      setIsConnectingGoogle(false);
      setGoogleError(t("networkErrorRetry"));
      return;
    }
    const data = await response.json();

    if (!response.ok) {
      setIsConnectingGoogle(false);
      setGoogleError(data.error ?? t("failedToStartGoogleConnection"));
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
      await fetch(`/api/v1/projects/${projectId}/google`, { method: "DELETE" });
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
      const response = await fetch(`/api/v1/projects/${projectId}/google/site`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ gscSiteUrl }),
      });
      if (response.ok) {
        setGoogleStatus(await response.json());
      } else {
        const data = await response.json().catch(() => ({}));
        setGoogleError(data.error ?? t("failedToSelectSearchConsoleProperty"));
      }
    } catch {
      setGoogleError(t("networkErrorRetry"));
    }
  }

  async function handleSaveGa4Property(event: React.FormEvent) {
    event.preventDefault();
    setGoogleError(null);
    try {
      const response = await fetch(`/api/v1/projects/${projectId}/google/ga4-property`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ga4PropertyId: ga4PropertyIdInput }),
      });
      if (response.ok) {
        setGoogleStatus(await response.json());
      } else {
        const data = await response.json().catch(() => ({}));
        setGoogleError(data.error ?? t("failedToSaveGa4PropertyId"));
      }
    } catch {
      setGoogleError(t("networkErrorRetry"));
    }
  }

  async function handleToggleAutoRefresh(enabled: boolean) {
    setGoogleError(null);
    try {
      const response = await fetch(`/api/v1/projects/${projectId}/google/auto-refresh`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      if (response.ok) {
        setGoogleStatus(await response.json());
      } else {
        const data = await response.json().catch(() => ({}));
        setGoogleError(data.error ?? t("failedToUpdateAutoRefresh"));
      }
    } catch {
      setGoogleError(t("networkErrorRetry"));
    }
  }

  async function handleRefreshGoogleTracking() {
    setIsRefreshingGoogle(true);
    setGoogleError(null);
    try {
      const response = await fetch(`/api/v1/projects/${projectId}/google/refresh`, { method: "POST" });
      const data = await response.json();
      if (data.searchPerformance?.status === "ok") setSearchPerformance(data.searchPerformance.snapshots);
      if (data.searchPerformance?.status === "error") setGoogleError(data.searchPerformance.error);
      if (data.analytics?.status === "ok") setAnalyticsSnapshots(data.analytics.snapshots);
      if (data.keywordOpportunities?.status === "ok") setKeywordOpportunities(data.keywordOpportunities.opportunities);
      if (data.keywordCannibalization?.status === "ok") setKeywordCannibalization(data.keywordCannibalization.issues);
      if (data.ctrUnderperformers?.status === "ok") setCtrUnderperformers(data.ctrUnderperformers.issues);
    } catch {
      setGoogleError(t("networkErrorRetry"));
    } finally {
      setIsRefreshingGoogle(false);
    }
  }

  async function handleGenerateSuggestion(opportunityId: string) {
    setGeneratingSuggestionId(opportunityId);
    setSuggestionError((errors) => ({ ...errors, [opportunityId]: "" }));

    let response: Response;
    try {
      response = await fetch(`/api/v1/projects/${projectId}/keyword-opportunities/${opportunityId}/suggestion`, {
        method: "POST",
      });
    } catch {
      setGeneratingSuggestionId(null);
      setSuggestionError((errors) => ({ ...errors, [opportunityId]: t("networkErrorRetry") }));
      return;
    }
    const data = await response.json();
    setGeneratingSuggestionId(null);
    if (!response.ok) {
      setSuggestionError((errors) => ({ ...errors, [opportunityId]: data.error ?? t("failedToGenerateSuggestion") }));
      return;
    }
    setKeywordOpportunities((rows) =>
      rows.map((row) => (row.id === opportunityId ? { ...row, suggestion: data.content } : row))
    );
  }

  return {
    googleStatus,
    isConnectingGoogle,
    isDisconnectingGoogle,
    isRefreshingGoogle,
    googleError,
    ga4PropertyIdInput,
    setGa4PropertyIdInput,
    searchPerformance,
    analyticsSnapshots,
    keywordOpportunities,
    keywordCannibalization,
    ctrUnderperformers,
    generatingSuggestionId,
    suggestionError,
    copiedSuggestionId,
    setCopiedSuggestionId,
    handleConnectGoogle,
    handleDisconnectGoogle,
    handleSelectGscSite,
    handleSaveGa4Property,
    handleToggleAutoRefresh,
    handleRefreshGoogleTracking,
    handleGenerateSuggestion,
  };
}
