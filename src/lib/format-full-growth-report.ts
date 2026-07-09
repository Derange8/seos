import type {
  AiVisibilityRunDto,
  AiVisibilityTrendPointDto,
  VisibilityExperimentDto,
} from "@/application/ai-visibility/dto";
import type { GrowthAnalysisDto, PageContentDraftDto } from "@/application/content-enrichment/dto";
import { formatAiVisibilityReport } from "@/lib/format-ai-visibility-report";
import { formatDraftForCopy } from "@/lib/format-content-draft";

// A single "copy everything" export of the whole Growth tab — AI Visibility,
// Growth Analysis, and every generated Page Content Draft — concatenated
// into one pasteable document. (Content Ideas lives on the Overview tab,
// not Growth, so it's out of scope here — this mirrors exactly what's on
// screen.) Each source section already had its own copy button
// (formatAiVisibilityReport, formatDraftForCopy); this just orders them
// under clear headers rather than inventing new formatting. Sections the
// user hasn't generated yet (no AI Visibility run, no Growth Analysis, no
// drafts) are simply omitted — never printed as "not generated" filler,
// since that adds noise without adding information to a document meant to
// be pasted straight into a doc or ticket.
export function formatFullGrowthReport(
  domain: string,
  data: {
    aiVisibility: AiVisibilityRunDto | null;
    aiVisibilityTrend: readonly AiVisibilityTrendPointDto[];
    experiments: readonly VisibilityExperimentDto[];
    growthAnalysis: GrowthAnalysisDto | null;
    contentDrafts: readonly PageContentDraftDto[];
  }
): string {
  const parts: string[] = [`SEOS GROWTH REPORT — ${domain}`, `Generated ${new Date().toLocaleString()}`];

  if (data.aiVisibility) {
    parts.push(
      "=".repeat(60),
      formatAiVisibilityReport(domain, data.aiVisibility, data.aiVisibilityTrend, data.experiments)
    );
  }

  if (data.growthAnalysis) {
    const ga = data.growthAnalysis;
    const gaParts: string[] = [
      "=".repeat(60),
      "GROWTH ANALYSIS",
      "",
      "Business Understanding",
      ga.businessUnderstanding,
      "",
      "Content Coverage Gaps",
      ga.contentGapsSummary,
    ];

    if (ga.opportunities.length > 0) {
      gaParts.push(
        "",
        "High-Impact Content Opportunities",
        ...ga.opportunities.map(
          (o) =>
            `  • [${o.priority}] ${o.title} (${o.pageType}, /${o.suggestedSlug})\n` +
            `      Intent: ${o.searchIntent}\n` +
            `      Why users search: ${o.whyUsersSearch}\n` +
            `      Revenue case: ${o.whyRevenue}`
        )
      );
    }

    if (ga.conversionOpportunities.length > 0) {
      gaParts.push(
        "",
        "Conversion Opportunities on Existing Pages",
        ...ga.conversionOpportunities.map((c) => `  • ${c.pageUrl}\n      ${c.recommendation}`)
      );
    }

    if (ga.missingCompetitorPages.length > 0) {
      gaParts.push("", "Competitor-Like Pages Missing", ...ga.missingCompetitorPages.map((p) => `  • ${p}`));
    }

    if (ga.topPages.length > 0) {
      gaParts.push("", "Next Pages To Create", ...ga.topPages.map((p, i) => `  ${i + 1}. ${p}`));
    }

    gaParts.push("", "Executive Summary", ga.executiveSummary);
    parts.push(gaParts.join("\n"));
  }

  if (data.contentDrafts.length > 0) {
    parts.push(
      "=".repeat(60),
      "PAGE CONTENT DRAFTS",
      ...data.contentDrafts.map((draft) => "-".repeat(40) + "\n" + formatDraftForCopy(draft))
    );
  }

  return parts.join("\n\n");
}
