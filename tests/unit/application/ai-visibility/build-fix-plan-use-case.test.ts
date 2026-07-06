import { describe, expect, it, vi } from "vitest";
import { BuildFixPlanUseCase } from "@/application/ai-visibility/use-cases/build-fix-plan-use-case";
import type { DiagnoseVisibilityGapUseCase } from "@/application/ai-visibility/use-cases/diagnose-visibility-gap-use-case";
import type { GenerateCitationContentUseCase } from "@/application/ai-visibility/use-cases/generate-citation-content-use-case";
import type { AiVisibilityRunRepositoryPort } from "@/application/ai-visibility/ports/ai-visibility-run-repository-port";
import { AiVisibilityProbeRun, type QueryOutcome } from "@/domain/ai-visibility/entities/probe-run";
import { AiVisibilityProviderNotConfiguredError } from "@/application/ai-visibility/errors";
import type { CitationDraft } from "@/application/ai-visibility/ports/ai-visibility-model-port";
import type { Slot } from "@/domain/ai-visibility/slot";

function oc(query: string, slots: Slot[]): QueryOutcome {
  return { query, slots, competitorsMentioned: [], citedSamples: 0, citations: [] };
}

function run(
  outcomes: QueryOutcome[],
  groundingMode: "parametric" | "web_grounded" = "web_grounded"
): AiVisibilityProbeRun {
  return AiVisibilityProbeRun.reconstitute({
    id: "r1",
    projectId: "p1",
    samplesPerQuery: 2,
    groundingMode,
    engine: "openai",
    runAt: new Date(),
    outcomes,
  });
}

function repoWith(latest: AiVisibilityProbeRun | null): AiVisibilityRunRepositoryPort {
  return {
    save: vi.fn(),
    findLatestByProjectId: vi.fn().mockResolvedValue(latest),
    findRecentByProjectId: vi.fn().mockResolvedValue(latest ? [latest] : []),
  };
}

const draft = (title: string): CitationDraft => ({ title, metaDescription: "", sections: [], faqs: [] });

// Minimal stubs typed as the concrete use-cases; BuildFixPlan only calls .execute.
function diagnoseStub(fn: (projectId: string, query: string) => Promise<string[]>) {
  return { execute: fn } as unknown as DiagnoseVisibilityGapUseCase;
}
function generateStub(fn: (projectId: string, query: string, gaps: string[]) => Promise<CitationDraft>) {
  return { execute: fn } as unknown as GenerateCitationContentUseCase;
}

describe("BuildFixPlanUseCase", () => {
  it("builds a plan item (diagnose then generate) for each winnable query", async () => {
    const runRepository = repoWith(
      run([oc("q-open-1", ["OPEN", "OPEN"]), oc("q-mentioned", ["MENTIONED", "MENTIONED"]), oc("q-open-2", ["OPEN", "OPEN"])])
    );
    const diagnose = diagnoseStub(async (_p, q) => [`gap for ${q}`]);
    const generate = generateStub(async (_p, q, gaps) => draft(`draft:${q}:${gaps.join(",")}`));

    const plan = await new BuildFixPlanUseCase({ runRepository, diagnose, generate }).execute("p1");

    // Only the two OPEN (winnable) queries become items; MENTIONED is skipped.
    expect(plan.items.map((i) => i.query).sort()).toEqual(["q-open-1", "q-open-2"]);
    expect(plan.items[0].gaps).toEqual(["gap for q-open-1"]);
    expect(plan.items[0].draft.title).toBe("draft:q-open-1:gap for q-open-1");
    expect(plan.skipped).toEqual([]);
    expect(plan.noGroundedRun).toBe(false);
  });

  it("returns an empty plan flagged noGroundedRun when the latest run is parametric", async () => {
    const runRepository = repoWith(run([oc("q-open", ["OPEN"])], "parametric"));
    const plan = await new BuildFixPlanUseCase({
      runRepository,
      diagnose: diagnoseStub(async () => ["g"]),
      generate: generateStub(async () => draft("d")),
    }).execute("p1");

    expect(plan.items).toEqual([]);
    expect(plan.noGroundedRun).toBe(true);
  });

  it("returns noGroundedRun when there is no run at all", async () => {
    const plan = await new BuildFixPlanUseCase({
      runRepository: repoWith(null),
      diagnose: diagnoseStub(async () => ["g"]),
      generate: generateStub(async () => draft("d")),
    }).execute("p1");
    expect(plan.noGroundedRun).toBe(true);
  });

  it("caps the plan at maxItems", async () => {
    const many = Array.from({ length: 6 }, (_, i) => oc(`open-${i}`, ["OPEN"]));
    const runRepository = repoWith(run(many));
    const plan = await new BuildFixPlanUseCase(
      { runRepository, diagnose: diagnoseStub(async () => ["g"]), generate: generateStub(async () => draft("d")) },
      2
    ).execute("p1");
    expect(plan.items).toHaveLength(2);
  });

  it("skips a query whose diagnose/generate fails, keeps the rest", async () => {
    const runRepository = repoWith(run([oc("good", ["OPEN"]), oc("bad", ["OPEN"])]));
    const diagnose = diagnoseStub(async (_p, q) => {
      if (q === "bad") throw new Error("model timeout");
      return ["g"];
    });
    const generate = generateStub(async (_p, q) => draft(`d:${q}`));

    const plan = await new BuildFixPlanUseCase({ runRepository, diagnose, generate }).execute("p1");

    expect(plan.items.map((i) => i.query)).toEqual(["good"]);
    expect(plan.skipped).toEqual(["bad"]);
  });

  it("throws (not skips) when the provider isn't configured — it would fail every query", async () => {
    const runRepository = repoWith(run([oc("q1", ["OPEN"]), oc("q2", ["OPEN"])]));
    const diagnose = diagnoseStub(async () => {
      throw new AiVisibilityProviderNotConfiguredError();
    });
    const generate = generateStub(async () => draft("d"));

    await expect(
      new BuildFixPlanUseCase({ runRepository, diagnose, generate }).execute("p1")
    ).rejects.toBeInstanceOf(AiVisibilityProviderNotConfiguredError);
  });
});
