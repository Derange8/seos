import type {
  AiVisibilityRunDto,
  AiVisibilityTrendPointDto,
  VisibilityExperimentDto,
} from "@/application/ai-visibility/dto";

// How many winnable/contested queries to list before summarizing the rest —
// same "keep it pasteable" instinct as the audit report's grouping.
const MAX_LISTED = 8;

function fmtSignedPct(n: number): string {
  return `${n > 0 ? "+" : ""}${n}%`;
}

// Plain-text export of a project's AI-visibility standing: the latest probe's
// scorecard, its movement since the previous run, the winnable/contested
// queries, and the resolved before/after experiments — meant to be pasted into
// a doc, an email to a client, a ticket, or an LLM in one shot. Mirrors
// formatAuditReport: a pure function over the DTOs the dashboard already holds,
// no fetch, no side effects.
//
// Honesty rule carried from Faz 1/2: a parametric run measured the model's
// memory, not the live AI-search surface, so it has no citations to report —
// the report says "not measured" rather than printing a misleading 0%.
export function formatAiVisibilityReport(
  domain: string,
  run: AiVisibilityRunDto,
  trend: readonly AiVisibilityTrendPointDto[],
  experiments: readonly VisibilityExperimentDto[]
): string {
  const grounded = run.groundingMode === "web_grounded";
  const sc = run.scorecard;
  const measuredOn = new Date(run.runAt).toLocaleString();

  const sections: string[] = [];

  sections.push(
    `Seos AI Visibility Report — ${domain}\n` +
      `Measured: ${measuredOn} (${grounded ? "live web search" : "model memory only"})\n` +
      `Samples: ${sc.totalSamples} across ${run.queries.length} quer${run.queries.length === 1 ? "y" : "ies"}` +
      (trend.length > 1 ? ` · ${trend.length} runs on record` : "")
  );

  // Scorecard
  const scLines = [
    `Recommended (mentioned): ${sc.mentionedPct}%`,
    `Winnable (open, no incumbent): ${sc.openPct}%`,
    `Contested (a competitor is recommended): ${sc.contestedPct}%`,
    `Cited (your domain in AI-search sources): ${grounded ? `${sc.citedPct}%` : "not measured (memory-only run)"}`,
  ];
  sections.push(`SCORECARD\n${scLines.map((l) => `  ${l}`).join("\n")}`);

  // Movement since last run
  if (run.delta) {
    const d = run.delta;
    const since = new Date(d.previousRunAt).toLocaleString();
    const deltaLines = [
      `Mentioned ${fmtSignedPct(d.mentionedPctDelta)}`,
      `Open ${fmtSignedPct(d.openPctDelta)}`,
      `Contested ${fmtSignedPct(d.contestedPctDelta)}`,
    ];
    // Only show cited movement when both runs measured it (see citedComparable);
    // otherwise it'd be a fabricated gain against a parametric baseline.
    if (grounded && d.citedComparable) deltaLines.push(`Cited ${fmtSignedPct(d.citedPctDelta)}`);
    sections.push(`SINCE LAST RUN (${since})\n  ${deltaLines.join(" · ")}`);
  }

  // Winnable queries
  if (sc.winnableQueries.length > 0) {
    const shown = sc.winnableQueries.slice(0, MAX_LISTED);
    const extra = sc.winnableQueries.length - shown.length;
    sections.push(
      `WINNABLE QUERIES (no incumbent yet — your clearest shots)\n` +
        shown.map((q) => `  • ${q}`).join("\n") +
        (extra > 0 ? `\n  …and ${extra} more` : "")
    );
  }

  // Competitors dominating
  if (sc.competitorFrequency.length > 0) {
    const shown = sc.competitorFrequency.slice(0, MAX_LISTED);
    sections.push(
      `COMPETITORS AI RECOMMENDS INSTEAD\n` +
        shown.map((c) => `  • ${c.name} (${c.queryCount} quer${c.queryCount === 1 ? "y" : "ies"})`).join("\n")
    );
  }

  // Before/after proof — resolved experiments
  const resolved = experiments.filter((e) => e.status === "RESOLVED" && e.outcome !== null);
  if (resolved.length > 0) {
    const lines = resolved.map((e) => {
      const move = `${e.baselineSlot} → ${e.outcomeSlot ?? "?"}`;
      const cited = e.citationMovement === "GAINED" ? " · now cited in sources 🔗" : "";
      return `  • "${e.query}": ${e.outcome} (${move}${cited})`;
    });
    sections.push(`BEFORE / AFTER (acted on, then re-measured)\n${lines.join("\n")}`);
  }

  return sections.join("\n\n");
}
