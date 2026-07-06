import { describe, expect, it, vi } from "vitest";
import { SuggestProbeTargetUseCase } from "@/application/ai-visibility/use-cases/suggest-probe-target-use-case";
import type {
  AiVisibilityModelPort,
  AskResult,
  GroundingMode,
  ProbeTargetSuggestionInput,
} from "@/application/ai-visibility/ports/ai-visibility-model-port";
import type { ProjectRepositoryPort } from "@/application/projects/ports/project-repository-port";
import type { CrawlJobRepositoryPort } from "@/application/crawling/ports/crawl-job-repository-port";
import type { PageRepositoryPort } from "@/application/crawling/ports/page-repository-port";
import { Project } from "@/domain/projects/entities/project";
import { DomainName } from "@/domain/projects/value-objects/domain-name";
import type { CrawlJob } from "@/domain/crawling/entities/crawl-job";
import { Page } from "@/domain/crawling/entities/page";
import { Url } from "@/domain/crawling/value-objects/url";

function domain(value: string): DomainName {
  const result = DomainName.create(value);
  if (!result.ok) throw new Error("expected ok domain");
  return result.value;
}

function url(value: string): Url {
  const result = Url.create(value);
  if (!result.ok) throw new Error("expected ok url");
  return result.value;
}

const crawlJobStub = { id: "job-1" } as unknown as CrawlJob;

class CapturingModel implements AiVisibilityModelPort {
  lastInput: ProbeTargetSuggestionInput | null = null;
  async ask(_query: string, mode: GroundingMode): Promise<AskResult> {
    return { answer: "", citations: [], groundingMode: mode };
  }
  async namesSpecificOption(): Promise<boolean> {
    return false;
  }
  async suggestProbeTarget(input: ProbeTargetSuggestionInput) {
    this.lastInput = input;
    return { queries: ["suggested q"], competitors: ["Polymarket"] };
  }
  async diagnoseVisibilityGap(): Promise<string[]> {
    return [];
  }
  async generateCitationContent() {
    return { title: "", metaDescription: "", sections: [], faqs: [] };
  }
}

function projectRepo(project: Project | null): ProjectRepositoryPort {
  return {
    findById: vi.fn().mockResolvedValue(project),
    save: vi.fn(),
    findByDomain: vi.fn(),
    findAll: vi.fn(),
    delete: vi.fn(),
  };
}

describe("SuggestProbeTargetUseCase", () => {
  it("passes the project's brand/domain plus crawled page titles as grounding hints", async () => {
    const project = Project.create("Janus", domain("janus.vote"));
    const page = Page.create("job-1", url("https://janus.vote/"), {
      statusCode: 200,
      title: "Janus — Prediction Market",
    });

    const model = new CapturingModel();
    const crawlJobRepository = {
      findLatestByProjectId: vi.fn().mockResolvedValue(crawlJobStub),
    } as unknown as CrawlJobRepositoryPort;
    const pageRepository = {
      findAllByCrawlJobId: vi.fn().mockResolvedValue([page]),
    } as unknown as PageRepositoryPort;

    const useCase = new SuggestProbeTargetUseCase({
      projectRepository: projectRepo(project),
      crawlJobRepository,
      pageRepository,
      model,
    });

    const suggestion = await useCase.execute(project.id);

    expect(suggestion.queries).toEqual(["suggested q"]);
    expect(model.lastInput?.brand).toBe("Janus");
    expect(model.lastInput?.domain).toBe("janus.vote");
    expect(model.lastInput?.pageHints).toEqual(["Janus — Prediction Market"]);
  });

  it("works with no crawl yet — falls back to brand/domain, empty hints", async () => {
    const project = Project.create("Janus", domain("janus.vote"));
    const model = new CapturingModel();
    const crawlJobRepository = {
      findLatestByProjectId: vi.fn().mockResolvedValue(null),
    } as unknown as CrawlJobRepositoryPort;
    const pageRepository = { findAllByCrawlJobId: vi.fn() } as unknown as PageRepositoryPort;

    const useCase = new SuggestProbeTargetUseCase({
      projectRepository: projectRepo(project),
      crawlJobRepository,
      pageRepository,
      model,
    });

    await useCase.execute(project.id);

    expect(model.lastInput?.pageHints).toEqual([]);
    expect(pageRepository.findAllByCrawlJobId).not.toHaveBeenCalled();
  });

  it("throws when the project does not exist", async () => {
    const useCase = new SuggestProbeTargetUseCase({
      projectRepository: projectRepo(null),
      crawlJobRepository: { findLatestByProjectId: vi.fn() } as unknown as CrawlJobRepositoryPort,
      pageRepository: { findAllByCrawlJobId: vi.fn() } as unknown as PageRepositoryPort,
      model: new CapturingModel(),
    });

    await expect(useCase.execute("missing")).rejects.toThrow(/not found/);
  });
});
