"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/hooks/use-language";
import type { ProjectDto } from "@/application/projects/dto";
import { EVENT_TYPE_LABEL, TABS, TRANSLATIONS, type TabId, type TranslationKey } from "./project-dashboard/shared";
import { OverviewTab } from "./project-dashboard/overview-tab";
import { IssuesTab } from "./project-dashboard/issues-tab";
import { GrowthTab } from "./project-dashboard/growth-tab";
import { IntegrationsTab } from "./project-dashboard/integrations-tab";
import { OutputsTab } from "./project-dashboard/outputs-tab";
import { useCrawlAudit } from "./project-dashboard/hooks/use-crawl-audit";
import { useWordPress } from "./project-dashboard/hooks/use-wordpress";
import { useGoogleIntegration } from "./project-dashboard/hooks/use-google-integration";
import { useAiVisibility, engineLabel, experimentOutcomeClass } from "./project-dashboard/hooks/use-ai-visibility";
import { useContentTools, formatDraftForCopy } from "./project-dashboard/hooks/use-content-tools";

export function ProjectDashboard({ project: initialProject }: { project: ProjectDto }) {
  const [project, setProject] = useState(initialProject);
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [language] = useLanguage();
  const t = (key: TranslationKey) => TRANSLATIONS[key][language];
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyMessage, setVerifyMessage] = useState<string | null>(null);
  const [isUpdatingAutoPilot, setIsUpdatingAutoPilot] = useState(false);

  const crawlAudit = useCrawlAudit(project.id, t);
  const wordPress = useWordPress(project.id, t);
  const google = useGoogleIntegration(project.id, t);
  const aiVisibility = useAiVisibility(project.id, t);
  const contentTools = useContentTools(project.id, t);

  async function handleVerify() {
    setIsVerifying(true);
    setVerifyMessage(null);

    let response: Response;
    try {
      response = await fetch(`/api/v1/projects/${project.id}/verify`, { method: "POST" });
    } catch {
      setIsVerifying(false);
      setVerifyMessage(t("networkErrorRetry"));
      return;
    }
    const data = await response.json();

    setIsVerifying(false);
    if (!response.ok) {
      setVerifyMessage(data.error ?? t("verificationCheckFailed"));
      return;
    }

    setProject(data);
    setVerifyMessage(data.isVerified ? t("domainVerified") : t("notVerifiedYetRecordNotFound"));
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

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{project.name}</h1>
        <span className="text-sm text-muted-foreground">{project.domain}</span>
        <Badge variant={project.isVerified ? "default" : "secondary"}>
          {project.isVerified ? t("verified") : t("unverified")}
        </Badge>
      </div>

      {crawlAudit.eventFailures.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-red-400">{t("someBackgroundProcessingFailed")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            <p className="text-muted-foreground">{t("backgroundStepsFailedNote")}</p>
            {crawlAudit.eventFailures.map((failure) => (
              <div key={failure.id} className="border-b border-white/10 py-1">
                <p className="font-medium">{EVENT_TYPE_LABEL[failure.eventType]?.[language] ?? failure.eventType}</p>
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
            {tab.id === "issues" && crawlAudit.auditRun && crawlAudit.auditRun.issues.length > 0 && (
              <span className="ml-1.5 text-xs text-muted-foreground">({crawlAudit.auditRun.issues.length})</span>
            )}
          </button>
        ))}
      </div>

      {activeTab === "overview" && (
        <OverviewTab
          auditRun={crawlAudit.auditRun}
          aiVisibility={aiVisibility.aiVisibility}
          fixCandidates={crawlAudit.fixCandidates}
          crawlJob={crawlAudit.crawlJob}
          pages={crawlAudit.pages}
          isStartingCrawl={crawlAudit.isStartingCrawl}
          crawlError={crawlAudit.crawlError}
          scores={crawlAudit.scores}
          delta={crawlAudit.delta}
          contentIdeas={contentTools.contentIdeas}
          isGeneratingContentIdeas={contentTools.isGeneratingContentIdeas}
          contentIdeasError={contentTools.contentIdeasError}
          copiedContentIdeaId={contentTools.copiedContentIdeaId}
          t={t}
          handleStartCrawl={crawlAudit.handleStartCrawl}
          handleGenerateContentIdeas={contentTools.handleGenerateContentIdeas}
          setActiveTab={setActiveTab}
          setCopiedContentIdeaId={contentTools.setCopiedContentIdeaId}
        />
      )}

      {activeTab === "issues" && (
        <IssuesTab
          project={project}
          auditRun={crawlAudit.auditRun}
          fixCandidates={crawlAudit.fixCandidates}
          issueGroups={crawlAudit.issueGroups}
          expandedRuleIds={crawlAudit.expandedRuleIds}
          toggleRuleExpanded={crawlAudit.toggleRuleExpanded}
          wordPressConnection={wordPress.wordPressConnection}
          fixActionErrors={crawlAudit.fixActionErrors}
          copiedFixId={crawlAudit.copiedFixId}
          fixActionPendingId={crawlAudit.fixActionPendingId}
          copiedFullReport={crawlAudit.copiedFullReport}
          setCopiedFullReport={crawlAudit.setCopiedFullReport}
          setCopiedFixId={crawlAudit.setCopiedFixId}
          handleApplyFix={crawlAudit.handleApplyFix}
          handleRevertFix={crawlAudit.handleRevertFix}
          fixAllPendingKey={crawlAudit.fixAllPendingKey}
          fixAllErrors={crawlAudit.fixAllErrors}
          handleApplyFixAll={crawlAudit.handleApplyFixAll}
          t={t}
          language={language}
        />
      )}

      {activeTab === "growth" && (
        <GrowthTab
          project={project}
          wordPressConnection={wordPress.wordPressConnection}
          pages={crawlAudit.pages}
          t={t}
          language={language}
          aiVisibility={aiVisibility.aiVisibility}
          aiVisibilityTrend={aiVisibility.aiVisibilityTrend}
          isProbingAiVisibility={aiVisibility.isProbingAiVisibility}
          engineComparison={aiVisibility.engineComparison}
          isComparingEngines={aiVisibility.isComparingEngines}
          isSuggestingQueries={aiVisibility.isSuggestingQueries}
          aiVisibilityError={aiVisibility.aiVisibilityError}
          aiVisibilityQueries={aiVisibility.aiVisibilityQueries}
          setAiVisibilityQueries={aiVisibility.setAiVisibilityQueries}
          aiVisibilityCompetitors={aiVisibility.aiVisibilityCompetitors}
          setAiVisibilityCompetitors={aiVisibility.setAiVisibilityCompetitors}
          aiVisibilityWebGrounded={aiVisibility.aiVisibilityWebGrounded}
          setAiVisibilityWebGrounded={aiVisibility.setAiVisibilityWebGrounded}
          diagnosingQuery={aiVisibility.diagnosingQuery}
          diagnoses={aiVisibility.diagnoses}
          diagnoseErrors={aiVisibility.diagnoseErrors}
          isBuildingFixPlan={aiVisibility.isBuildingFixPlan}
          fixPlanError={aiVisibility.fixPlanError}
          draftingQuery={aiVisibility.draftingQuery}
          citationDrafts={aiVisibility.citationDrafts}
          draftGapErrors={aiVisibility.draftGapErrors}
          copiedDraftQuery={aiVisibility.copiedDraftQuery}
          publishingCitationQuery={aiVisibility.publishingCitationQuery}
          citationPublishErrors={aiVisibility.citationPublishErrors}
          citationPublishedQueries={aiVisibility.citationPublishedQueries}
          experiments={aiVisibility.experiments}
          copiedAiVisibilityReport={aiVisibility.copiedAiVisibilityReport}
          setCopiedAiVisibilityReport={aiVisibility.setCopiedAiVisibilityReport}
          handleBuildFixPlan={aiVisibility.handleBuildFixPlan}
          handleSuggestAiVisibilityQueries={aiVisibility.handleSuggestAiVisibilityQueries}
          handleRunAiVisibilityProbe={aiVisibility.handleRunAiVisibilityProbe}
          handleCompareEngines={aiVisibility.handleCompareEngines}
          handleDiagnoseGap={aiVisibility.handleDiagnoseGap}
          handleGenerateCitationDraft={aiVisibility.handleGenerateCitationDraft}
          handleCopyCitationDraft={aiVisibility.handleCopyCitationDraft}
          handlePublishCitationDraft={aiVisibility.handlePublishCitationDraft}
          engineLabel={engineLabel}
          experimentOutcomeClass={experimentOutcomeClass}
          growthAnalysis={contentTools.growthAnalysis}
          isGeneratingGrowthAnalysis={contentTools.isGeneratingGrowthAnalysis}
          growthAnalysisError={contentTools.growthAnalysisError}
          handleGenerateGrowthAnalysis={contentTools.handleGenerateGrowthAnalysis}
          contentDrafts={contentTools.contentDrafts}
          draftPageUrl={contentTools.draftPageUrl}
          setDraftPageUrl={contentTools.setDraftPageUrl}
          generatingDraft={contentTools.generatingDraft}
          draftError={contentTools.draftError}
          copiedDraftUrl={contentTools.copiedDraftUrl}
          setCopiedDraftUrl={contentTools.setCopiedDraftUrl}
          draftActionPendingId={contentTools.draftActionPendingId}
          draftActionErrors={contentTools.draftActionErrors}
          handleGenerateDraft={contentTools.handleGenerateDraft}
          handlePublishDraft={contentTools.handlePublishDraft}
          handleRevertDraft={contentTools.handleRevertDraft}
          formatDraftForCopy={formatDraftForCopy}
        />
      )}

      {activeTab === "integrations" && (
        <IntegrationsTab
          project={project}
          t={t}
          wordPressConnection={wordPress.wordPressConnection}
          wpSiteUrl={wordPress.wpSiteUrl}
          setWpSiteUrl={wordPress.setWpSiteUrl}
          wpUsername={wordPress.wpUsername}
          setWpUsername={wordPress.setWpUsername}
          wpApplicationPassword={wordPress.wpApplicationPassword}
          setWpApplicationPassword={wordPress.setWpApplicationPassword}
          isConnectingWordPress={wordPress.isConnectingWordPress}
          isDisconnectingWordPress={wordPress.isDisconnectingWordPress}
          wordPressError={wordPress.wordPressError}
          handleConnectWordPress={wordPress.handleConnectWordPress}
          handleDisconnectWordPress={wordPress.handleDisconnectWordPress}
          isUpdatingAutoPilot={isUpdatingAutoPilot}
          handleToggleAutoPilot={handleToggleAutoPilot}
          googleStatus={google.googleStatus}
          isConnectingGoogle={google.isConnectingGoogle}
          isDisconnectingGoogle={google.isDisconnectingGoogle}
          isRefreshingGoogle={google.isRefreshingGoogle}
          googleError={google.googleError}
          ga4PropertyIdInput={google.ga4PropertyIdInput}
          setGa4PropertyIdInput={google.setGa4PropertyIdInput}
          searchPerformance={google.searchPerformance}
          analyticsSnapshots={google.analyticsSnapshots}
          handleConnectGoogle={google.handleConnectGoogle}
          handleDisconnectGoogle={google.handleDisconnectGoogle}
          handleSelectGscSite={google.handleSelectGscSite}
          handleSaveGa4Property={google.handleSaveGa4Property}
          handleToggleAutoRefresh={google.handleToggleAutoRefresh}
          handleRefreshGoogleTracking={google.handleRefreshGoogleTracking}
          keywordOpportunities={google.keywordOpportunities}
          generatingSuggestionId={google.generatingSuggestionId}
          suggestionError={google.suggestionError}
          copiedSuggestionId={google.copiedSuggestionId}
          setCopiedSuggestionId={google.setCopiedSuggestionId}
          handleGenerateSuggestion={google.handleGenerateSuggestion}
          keywordCannibalization={google.keywordCannibalization}
          ctrUnderperformers={google.ctrUnderperformers}
        />
      )}

      {activeTab === "outputs" && (
        <OutputsTab
          t={t}
          language={language}
          robots={crawlAudit.robots}
          showRobotsTxt={crawlAudit.showRobotsTxt}
          setShowRobotsTxt={crawlAudit.setShowRobotsTxt}
          schemaMarkup={crawlAudit.schemaMarkup}
          expandedSchemaId={crawlAudit.expandedSchemaId}
          setExpandedSchemaId={crawlAudit.setExpandedSchemaId}
          sitemap={crawlAudit.sitemap}
          showSitemapXml={crawlAudit.showSitemapXml}
          setShowSitemapXml={crawlAudit.setShowSitemapXml}
          llmsTxt={crawlAudit.llmsTxt}
          showLlmsTxt={crawlAudit.showLlmsTxt}
          setShowLlmsTxt={crawlAudit.setShowLlmsTxt}
        />
      )}
    </div>
  );
}
