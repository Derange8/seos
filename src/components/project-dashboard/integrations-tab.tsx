import type { Dispatch, FormEvent, SetStateAction } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ProjectDto } from "@/application/projects/dto";
import type { WordPressConnectionDto } from "@/application/wordpress/dto";
import type { SearchPerformanceSnapshotDto, AnalyticsSnapshotDto, KeywordCannibalizationIssueDto, CtrUnderperformerDto } from "@/application/tracking/dto";
import { type GoogleStatusDto, type KeywordOpportunityRow, type TranslationKey } from "./shared";

export interface IntegrationsTabProps {
  project: ProjectDto;
  t: (key: TranslationKey) => string;

  // WordPress
  wordPressConnection: WordPressConnectionDto | null;
  wpSiteUrl: string;
  setWpSiteUrl: Dispatch<SetStateAction<string>>;
  wpUsername: string;
  setWpUsername: Dispatch<SetStateAction<string>>;
  wpApplicationPassword: string;
  setWpApplicationPassword: Dispatch<SetStateAction<string>>;
  isConnectingWordPress: boolean;
  isDisconnectingWordPress: boolean;
  wordPressError: string | null;
  handleConnectWordPress: (event: FormEvent) => void;
  handleDisconnectWordPress: () => void;

  // Otomatik Pilot
  isUpdatingAutoPilot: boolean;
  handleToggleAutoPilot: () => void;

  // Google / Search Performance
  googleStatus: GoogleStatusDto;
  isConnectingGoogle: boolean;
  isDisconnectingGoogle: boolean;
  isRefreshingGoogle: boolean;
  googleError: string | null;
  ga4PropertyIdInput: string;
  setGa4PropertyIdInput: Dispatch<SetStateAction<string>>;
  searchPerformance: SearchPerformanceSnapshotDto[];
  analyticsSnapshots: AnalyticsSnapshotDto[];
  handleConnectGoogle: () => void;
  handleDisconnectGoogle: () => void;
  handleSelectGscSite: (gscSiteUrl: string) => void;
  handleSaveGa4Property: (event: FormEvent) => void;
  handleToggleAutoRefresh: (enabled: boolean) => void;
  handleRefreshGoogleTracking: () => void;

  // Keyword Opportunities
  keywordOpportunities: KeywordOpportunityRow[];
  generatingSuggestionId: string | null;
  suggestionError: Record<string, string>;
  copiedSuggestionId: string | null;
  setCopiedSuggestionId: Dispatch<SetStateAction<string | null>>;
  handleGenerateSuggestion: (opportunityId: string) => void;

  // Keyword Cannibalization
  keywordCannibalization: KeywordCannibalizationIssueDto[];

  // CTR Underperformers
  ctrUnderperformers: CtrUnderperformerDto[];
}

// A small connected/disconnected status pill for the WordPress/Google cards
// — replaces a plain sentence with something scannable at a glance, matching
// how Linear/Vercel surface integration state in their settings screens.
function ConnectionStatusPill({ connected, t }: { connected: boolean; t: (key: TranslationKey) => string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
        connected
          ? "bg-success/10 text-success"
          : "bg-white/5 text-muted-foreground"
      }`}
    >
      <span className={`size-1.5 rounded-full ${connected ? "bg-success" : "bg-muted-foreground/60"}`} />
      {connected ? t("connectedLabel") : t("notConnected")}
    </span>
  );
}

export function IntegrationsTab({
  project,
  t,
  wordPressConnection,
  wpSiteUrl,
  setWpSiteUrl,
  wpUsername,
  setWpUsername,
  wpApplicationPassword,
  setWpApplicationPassword,
  isConnectingWordPress,
  isDisconnectingWordPress,
  wordPressError,
  handleConnectWordPress,
  handleDisconnectWordPress,
  isUpdatingAutoPilot,
  handleToggleAutoPilot,
  googleStatus,
  isConnectingGoogle,
  isDisconnectingGoogle,
  isRefreshingGoogle,
  googleError,
  ga4PropertyIdInput,
  setGa4PropertyIdInput,
  searchPerformance,
  analyticsSnapshots,
  handleConnectGoogle,
  handleDisconnectGoogle,
  handleSelectGscSite,
  handleSaveGa4Property,
  handleToggleAutoRefresh,
  handleRefreshGoogleTracking,
  keywordOpportunities,
  generatingSuggestionId,
  suggestionError,
  copiedSuggestionId,
  setCopiedSuggestionId,
  handleGenerateSuggestion,
  keywordCannibalization,
  ctrUnderperformers,
}: IntegrationsTabProps) {
  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>{t("cardWordPress")}</CardTitle>
          <CardAction>
            <ConnectionStatusPill connected={!!wordPressConnection} t={t} />
          </CardAction>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 text-sm">
          {wordPressConnection ? (
            <>
              <div className="inset-panel flex flex-col gap-1 rounded-xl p-3">
                <span className="text-xs uppercase tracking-wide text-muted-foreground">{t("siteLabel")}</span>
                <span className="font-medium text-foreground">{wordPressConnection.siteUrl}</span>
                <span className="text-xs text-muted-foreground">{t("asLabel")} {wordPressConnection.username}</span>
              </div>
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
                {t("wordPressConnectDescription")}
              </p>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="wp-site-url">{t("siteUrl")}</Label>
                <Input
                  id="wp-site-url"
                  value={wpSiteUrl}
                  onChange={(e) => setWpSiteUrl(e.target.value)}
                  placeholder="https://example.com"
                  required
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="wp-username">{t("username")}</Label>
                <Input id="wp-username" value={wpUsername} onChange={(e) => setWpUsername(e.target.value)} required />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="wp-app-password">{t("applicationPasswordField")}</Label>
                <Input
                  id="wp-app-password"
                  type="password"
                  value={wpApplicationPassword}
                  onChange={(e) => setWpApplicationPassword(e.target.value)}
                  required
                />
              </div>
              {wordPressError && <p className="text-sm text-destructive">{wordPressError}</p>}
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

      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle>{t("cardSearchPerformance")}</CardTitle>
          <CardAction>
            <ConnectionStatusPill connected={googleStatus.connected} t={t} />
          </CardAction>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 text-sm">
          {!googleStatus.connected ? (
            <>
              <p className="text-muted-foreground">
                {t("googleConnectDescription")}
              </p>
              <Button onClick={handleConnectGoogle} disabled={isConnectingGoogle} className="self-start">
                {isConnectingGoogle ? t("waitingForAuthorization") : t("connectGoogleAccount")}
              </Button>
              {googleError && <p className="text-sm text-destructive">{googleError}</p>}
            </>
          ) : (
            <>
              {!googleStatus.gscSiteUrl ? (
                googleStatus.availableSites && googleStatus.availableSites.length > 0 ? (
                  <div className="flex flex-col gap-2">
                    <p className="text-muted-foreground">{t("pickSearchConsoleProperty")}</p>
                    <div className="flex flex-wrap gap-2">
                      {googleStatus.availableSites.map((site) => (
                        <Button key={site} variant="outline" size="sm" onClick={() => handleSelectGscSite(site)}>
                          {site}
                        </Button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-muted-foreground">
                    {t("noSearchConsoleProperties")}
                  </p>
                )
              ) : (
                <div className="inset-panel flex flex-col gap-1 rounded-xl p-3">
                  <span className="text-xs uppercase tracking-wide text-muted-foreground">{t("searchConsoleLabel")}</span>
                  <span className="font-medium text-foreground">{googleStatus.gscSiteUrl}</span>
                </div>
              )}

              {searchPerformance.length > 0 && (
                <div className="inset-panel overflow-x-auto rounded-xl">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-white/10">
                        <th className="px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">{t("dateLabel")}</th>
                        <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">{t("clicksLabel")}</th>
                        <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">{t("impressionsLabel")}</th>
                        <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">{t("ctrLabel")}</th>
                        <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">{t("avgPositionLabel")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {searchPerformance.slice(0, 14).map((row) => (
                        <tr key={row.date} className="border-b border-white/5 last:border-0 hover:bg-white/5">
                          <td className="px-3 py-2 text-muted-foreground">{row.date}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{row.clicks}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{row.impressions}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{(row.ctr * 100).toFixed(1)}%</td>
                          <td className="px-3 py-2 text-right tabular-nums">{row.position.toFixed(1)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <form onSubmit={handleSaveGa4Property} className="flex flex-col gap-2">
                <Label htmlFor="ga4-property-id">{t("ga4PropertyIdLabel")}</Label>
                <div className="flex gap-2">
                  <Input
                    id="ga4-property-id"
                    value={ga4PropertyIdInput}
                    onChange={(e) => setGa4PropertyIdInput(e.target.value)}
                    placeholder="e.g. 501234567"
                  />
                  <Button type="submit" variant="outline">
                    {t("save")}
                  </Button>
                </div>
              </form>

              {analyticsSnapshots.length > 0 && (
                <div className="inset-panel overflow-x-auto rounded-xl">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-white/10">
                        <th className="px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">{t("dateLabel")}</th>
                        <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">{t("organicSessions")}</th>
                        <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">{t("conversionsLabel")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analyticsSnapshots.slice(0, 14).map((row) => (
                        <tr key={row.date} className="border-b border-white/5 last:border-0 hover:bg-white/5">
                          <td className="px-3 py-2 text-muted-foreground">{row.date}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{row.organicSessions}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{row.conversions}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <Label className="flex items-center gap-2 font-normal text-muted-foreground">
                <input
                  type="checkbox"
                  checked={googleStatus.autoRefreshEnabled}
                  onChange={(e) => handleToggleAutoRefresh(e.target.checked)}
                  className="size-4 rounded-[4px] border border-input bg-transparent accent-primary outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                />
                {t("autoRefreshDaily")}
              </Label>

              <div className="flex gap-2">
                <Button onClick={handleRefreshGoogleTracking} disabled={isRefreshingGoogle} variant="outline" size="sm">
                  {isRefreshingGoogle ? t("refreshing") : t("refreshNow")}
                </Button>
                <Button onClick={handleDisconnectGoogle} disabled={isDisconnectingGoogle} variant="outline" size="sm">
                  {isDisconnectingGoogle ? t("disconnecting") : t("disconnect")}
                </Button>
              </div>
              {googleError && <p className="text-sm text-destructive">{googleError}</p>}
            </>
          )}
        </CardContent>
      </Card>

      {keywordOpportunities.length > 0 && (
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>{t("keywordOpportunitiesTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            <p className="text-muted-foreground">
              {t("keywordOpportunitiesDescription")}
            </p>
            <div className="flex flex-col gap-2">
              {keywordOpportunities.map((row) => (
                <div key={row.id} className="inset-panel flex flex-col gap-2 rounded-xl p-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                    <span className="text-sm font-medium text-foreground">{row.query}</span>
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {t("positionLabel")} {row.position.toFixed(1)} · {row.impressions} {t("impressionsInline")} · {row.clicks} {t("clicksInline")}
                    </span>
                  </div>
                  <p className="truncate text-xs text-muted-foreground" title={row.pageUrl}>
                    {row.pageUrl}
                  </p>

                  {row.suggestion ? (
                    <div className="mt-1 flex items-start gap-2 rounded-lg bg-black/20 p-2.5">
                      <p className="flex-1 text-xs text-foreground/90">{row.suggestion}</p>
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
                    <div className="mt-1">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={generatingSuggestionId === row.id}
                        onClick={() => handleGenerateSuggestion(row.id)}
                      >
                        {generatingSuggestionId === row.id ? t("generatingEllipsis") : t("generateContentSuggestion")}
                      </Button>
                      {suggestionError[row.id] && (
                        <p className="mt-1 text-xs text-destructive">{suggestionError[row.id]}</p>
                      )}
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
            <CardTitle>{t("keywordCannibalizationTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            <p className="text-muted-foreground">
              {t("keywordCannibalizationDescription")}
            </p>
            <div className="flex flex-col gap-2">
              {keywordCannibalization.map((issue) => (
                <div key={issue.id} className="inset-panel flex flex-col gap-2 rounded-xl p-3">
                  <span className="text-sm font-medium text-foreground">{issue.query}</span>
                  <div className="flex flex-col gap-1.5">
                    {issue.pages.map((page) => (
                      <div key={page.pageUrl} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                        <p className="truncate text-xs text-muted-foreground" title={page.pageUrl}>
                          {page.pageUrl}
                        </p>
                        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                          {t("positionLabel")} {page.position.toFixed(1)} · {page.impressions} {t("impressionsInline")}
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
            <CardTitle>{t("ctrUnderperformersTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            <p className="text-muted-foreground">
              {t("ctrUnderperformersDescription")}
            </p>
            <div className="flex flex-col gap-2">
              {ctrUnderperformers.map((issue) => (
                <div key={issue.id} className="inset-panel flex flex-col gap-2 rounded-xl p-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                    <span className="text-sm font-medium text-foreground">{issue.query}</span>
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {t("positionLabel")} {issue.position.toFixed(1)} · {(issue.ctr * 100).toFixed(1)}% {t("ctrVsLabel")}{" "}
                      {(issue.expectedCtr * 100).toFixed(1)}% {t("expectedLabel")}
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
  );
}
