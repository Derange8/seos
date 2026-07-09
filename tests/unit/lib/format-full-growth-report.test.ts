import { describe, expect, it } from "vitest";
import { formatFullGrowthReport } from "@/lib/format-full-growth-report";
import type { AiVisibilityRunDto } from "@/application/ai-visibility/dto";
import type { AiVisibilityScorecard } from "@/domain/ai-visibility/services/scorecard";
import type { GrowthAnalysisDto, PageContentDraftDto } from "@/application/content-enrichment/dto";

function scorecard(overrides: Partial<AiVisibilityScorecard> = {}): AiVisibilityScorecard {
  return {
    totalSamples: 8,
    mentioned: 2,
    contested: 3,
    open: 3,
    mentionedPct: 25,
    contestedPct: 38,
    openPct: 38,
    citedSamples: 2,
    citedPct: 25,
    competitorFrequency: [],
    winnableQueries: [],
    lowConfidenceQueries: [],
    ...overrides,
  };
}

function aiVisibilityRun(overrides: Partial<AiVisibilityRunDto> = {}): AiVisibilityRunDto {
  return {
    runAt: "2026-07-05T10:00:00.000Z",
    samplesPerQuery: 2,
    groundingMode: "web_grounded",
    engine: "openai",
    scorecard: scorecard(),
    queries: [],
    delta: null,
    ...overrides,
  };
}

function growthAnalysis(overrides: Partial<GrowthAnalysisDto> = {}): GrowthAnalysisDto {
  return {
    id: "ga1",
    businessUnderstanding: "Acme sells widgets online.",
    contentGapsSummary: "No comparison pages between top products.",
    opportunities: [
      {
        title: "Widget Buying Guide",
        searchIntent: "informational",
        whyUsersSearch: "Shoppers compare widgets before buying.",
        whyRevenue: "Drives qualified traffic to product pages.",
        suggestedSlug: "widget-buying-guide",
        pageType: "BLOG_ARTICLE",
        priority: "HIGH",
      },
    ],
    conversionOpportunities: [{ pageUrl: "https://acme.com/widgets", recommendation: "Add customer reviews." }],
    missingCompetitorPages: ["Widget comparison chart"],
    topPages: ["Widget Buying Guide", "Widget FAQ"],
    executiveSummary: "Focus on comparison content next quarter.",
    generatedAt: "2026-07-05T10:00:00.000Z",
    ...overrides,
  };
}

function draft(overrides: Partial<PageContentDraftDto> = {}): PageContentDraftDto {
  return {
    id: "d1",
    pageUrl: "https://acme.com/widgets",
    suggestedTitle: "Best Widgets 2026",
    suggestedMetaDescription: "Compare the best widgets on the market.",
    bodySections: [{ heading: "Overview", content: "Widgets come in many shapes." }],
    faqs: [{ question: "What is a widget?", answer: "A small useful device." }],
    generatedAt: "2026-07-05T10:00:00.000Z",
    status: "DRAFT",
    ...overrides,
  };
}

describe("formatFullGrowthReport", () => {
  it("includes the domain header and a generated timestamp", () => {
    const report = formatFullGrowthReport("acme.com", {
      aiVisibility: null,
      aiVisibilityTrend: [],
      experiments: [],
      growthAnalysis: null,
      contentDrafts: [],
    });
    expect(report).toContain("SEOS GROWTH REPORT — acme.com");
    expect(report).toContain("Generated");
  });

  it("embeds the AI visibility report when a run exists", () => {
    const report = formatFullGrowthReport("acme.com", {
      aiVisibility: aiVisibilityRun(),
      aiVisibilityTrend: [],
      experiments: [],
      growthAnalysis: null,
      contentDrafts: [],
    });
    expect(report).toContain("Seos AI Visibility Report — acme.com");
    expect(report).toContain("Recommended (mentioned): 25%");
  });

  it("omits the AI visibility section when no run exists", () => {
    const report = formatFullGrowthReport("acme.com", {
      aiVisibility: null,
      aiVisibilityTrend: [],
      experiments: [],
      growthAnalysis: null,
      contentDrafts: [],
    });
    expect(report).not.toContain("Seos AI Visibility Report");
  });

  it("includes growth analysis sections: business understanding, opportunities, executive summary", () => {
    const report = formatFullGrowthReport("acme.com", {
      aiVisibility: null,
      aiVisibilityTrend: [],
      experiments: [],
      growthAnalysis: growthAnalysis(),
      contentDrafts: [],
    });
    expect(report).toContain("GROWTH ANALYSIS");
    expect(report).toContain("Acme sells widgets online.");
    expect(report).toContain("[HIGH] Widget Buying Guide (BLOG_ARTICLE, /widget-buying-guide)");
    expect(report).toContain("Add customer reviews.");
    expect(report).toContain("Widget comparison chart");
    expect(report).toContain("1. Widget Buying Guide");
    expect(report).toContain("Focus on comparison content next quarter.");
  });

  it("omits the growth analysis section when none was generated", () => {
    const report = formatFullGrowthReport("acme.com", {
      aiVisibility: null,
      aiVisibilityTrend: [],
      experiments: [],
      growthAnalysis: null,
      contentDrafts: [],
    });
    expect(report).not.toContain("GROWTH ANALYSIS");
  });

  it("includes every page content draft under one PAGE CONTENT DRAFTS header", () => {
    const report = formatFullGrowthReport("acme.com", {
      aiVisibility: null,
      aiVisibilityTrend: [],
      experiments: [],
      growthAnalysis: null,
      contentDrafts: [draft(), draft({ id: "d2", pageUrl: "https://acme.com/faq", suggestedTitle: "Widget FAQ" })],
    });
    expect(report).toContain("PAGE CONTENT DRAFTS");
    expect(report).toContain("Title: Best Widgets 2026");
    expect(report).toContain("Title: Widget FAQ");
  });

  it("omits the drafts section when there are none", () => {
    const report = formatFullGrowthReport("acme.com", {
      aiVisibility: null,
      aiVisibilityTrend: [],
      experiments: [],
      growthAnalysis: null,
      contentDrafts: [],
    });
    expect(report).not.toContain("PAGE CONTENT DRAFTS");
  });

  it("combines all three sections in order when everything is present", () => {
    const report = formatFullGrowthReport("acme.com", {
      aiVisibility: aiVisibilityRun(),
      aiVisibilityTrend: [],
      experiments: [],
      growthAnalysis: growthAnalysis(),
      contentDrafts: [draft()],
    });
    const aiIndex = report.indexOf("Seos AI Visibility Report");
    const gaIndex = report.indexOf("GROWTH ANALYSIS");
    const draftsIndex = report.indexOf("PAGE CONTENT DRAFTS");
    expect(aiIndex).toBeGreaterThanOrEqual(0);
    expect(gaIndex).toBeGreaterThan(aiIndex);
    expect(draftsIndex).toBeGreaterThan(gaIndex);
  });
});
