import type {
  AiVisibilityModelPort,
  ProbeTargetSuggestion,
} from "@/application/ai-visibility/ports/ai-visibility-model-port";
import type { ProjectRepositoryPort } from "@/application/projects/ports/project-repository-port";
import type { CrawlJobRepositoryPort } from "@/application/crawling/ports/crawl-job-repository-port";
import type { PageRepositoryPort } from "@/application/crawling/ports/page-repository-port";

export interface SuggestProbeTargetDeps {
  projectRepository: ProjectRepositoryPort;
  crawlJobRepository: CrawlJobRepositoryPort;
  pageRepository: PageRepositoryPort;
  model: AiVisibilityModelPort;
}

// A few page titles are plenty to ground the suggestion — no need to send the
// whole crawl.
const MAX_HINTS = 30;

// Proposes buyer-intent queries + likely competitors for a project so the
// dashboard can prefill the probe form instead of making the user hand-write
// them. Grounds the model in the project's own crawled page titles when a
// crawl exists; falls back to brand/domain alone otherwise. Only reachable
// with a valid projectId (route guards it), so a missing project is a real
// invariant violation, not an expected branch — hence no Result wrapper.
export class SuggestProbeTargetUseCase {
  constructor(private readonly deps: SuggestProbeTargetDeps) {}

  async execute(projectId: string): Promise<ProbeTargetSuggestion> {
    const project = await this.deps.projectRepository.findById(projectId);
    if (!project) throw new Error(`Project "${projectId}" not found`);

    const pageHints = await this.collectHints(projectId);
    return this.deps.model.suggestProbeTarget({
      brand: project.name,
      domain: project.domain.value,
      pageHints,
    });
  }

  private async collectHints(projectId: string): Promise<string[]> {
    const crawlJob = await this.deps.crawlJobRepository.findLatestByProjectId(projectId);
    if (!crawlJob) return [];

    const pages = await this.deps.pageRepository.findAllByCrawlJobId(crawlJob.id);
    const hints = new Set<string>();
    for (const page of pages) {
      const hint = (page.title ?? page.h1 ?? "").trim();
      if (hint.length > 0) hints.add(hint);
      if (hints.size >= MAX_HINTS) break;
    }
    return [...hints];
  }
}
