import type { CitationDraft } from "@/application/ai-visibility/ports/ai-visibility-model-port";
import type { AiVisibilityRunRepositoryPort } from "@/application/ai-visibility/ports/ai-visibility-run-repository-port";
import type { DiagnoseVisibilityGapUseCase } from "@/application/ai-visibility/use-cases/diagnose-visibility-gap-use-case";
import type { GenerateCitationContentUseCase } from "@/application/ai-visibility/use-cases/generate-citation-content-use-case";
import { buildScorecard } from "@/domain/ai-visibility/services/scorecard";
import { AiVisibilityProviderNotConfiguredError } from "@/application/ai-visibility/errors";
import type { Logger } from "@/shared/logger";

// One prepared fix: the query to win, the diagnosis gaps, and the ready draft.
export interface FixPlanItem {
  query: string;
  gaps: string[];
  draft: CitationDraft;
}

export interface FixPlan {
  // Queries with a prepared draft, ready for the user's approval gate.
  items: FixPlanItem[];
  // Queries that were candidates but whose diagnose/generate failed — surfaced
  // honestly rather than silently dropped, same partial-failure discipline as
  // the probe use case.
  skipped: string[];
  // True when there was no web-grounded run to plan from (parametric runs can't
  // measure citation, so a fix plan built on them would be measuring nothing).
  noGroundedRun: boolean;
}

export interface BuildFixPlanDeps {
  runRepository: AiVisibilityRunRepositoryPort;
  diagnose: DiagnoseVisibilityGapUseCase;
  generate: GenerateCitationContentUseCase;
  logger?: Logger;
}

// Each item costs two LLM calls (diagnose + generate); cap the plan so a big
// winnable list can't fan out into a runaway spend.
const DEFAULT_MAX_ITEMS = 5;

// The middle of the autonomous loop, automated: for the most-winnable queries a
// probe found (dominant slot OPEN — no incumbent, the clearest shot at getting
// recommended), auto-run Diagnose then Generate so the user gets ready drafts
// behind a single approval gate instead of clicking "Why not?" and "Draft" for
// each query by hand.
//
// Deliberately built ONLY from a web-grounded run: citation — the payoff this
// whole loop optimizes for — only exists on the live-search surface, so
// planning off a parametric (memory-only) run would be optimizing a metric that
// run never measured. A parametric latest run yields an empty plan flagged
// noGroundedRun, not a guess.
export class BuildFixPlanUseCase {
  private readonly maxItems: number;

  constructor(
    private readonly deps: BuildFixPlanDeps,
    maxItems: number = DEFAULT_MAX_ITEMS
  ) {
    this.maxItems = maxItems;
  }

  async execute(projectId: string): Promise<FixPlan> {
    const run = await this.deps.runRepository.findLatestByProjectId(projectId);
    if (!run || run.groundingMode !== "web_grounded") {
      return { items: [], skipped: [], noGroundedRun: true };
    }

    const winnable = buildScorecard(run.outcomes).winnableQueries.slice(0, this.maxItems);

    const items: FixPlanItem[] = [];
    const skipped: string[] = [];

    for (const query of winnable) {
      try {
        const gaps = await this.deps.diagnose.execute(projectId, query);
        const draft = await this.deps.generate.execute(projectId, query, gaps);
        items.push({ query, gaps, draft });
      } catch (error) {
        // A configuration error (no LLM provider) will hit every query — fail
        // the whole plan loudly rather than returning an all-skipped result
        // that reads like "nothing to fix".
        if (error instanceof AiVisibilityProviderNotConfiguredError) throw error;
        this.deps.logger?.warn("Fix plan: query skipped, diagnose/generate failed", {
          query,
          error: error instanceof Error ? error.message : String(error),
        });
        skipped.push(query);
      }
    }

    return { items, skipped, noGroundedRun: false };
  }
}
