import { LlmsTxtFile } from "@/domain/llms-txt/entities/llms-txt-file";
import { isLlmsTxtEligible, renderLlmsTxt } from "@/domain/llms-txt/services/llms-txt-generator";
import type { LlmsTxtRepositoryPort } from "@/application/llms-txt/ports/llms-txt-repository-port";
import type { PageRepositoryPort } from "@/application/crawling/ports/page-repository-port";
import type { ProjectRepositoryPort } from "@/application/projects/ports/project-repository-port";

export interface GenerateLlmsTxtDeps {
  pageRepository: PageRepositoryPort;
  projectRepository: ProjectRepositoryPort;
  llmsTxtRepository: LlmsTxtRepositoryPort;
}

// Only reachable from CrawlJobCompleted, where projectId is guaranteed to
// reference a real project by construction — same reasoning as
// GenerateSitemapUseCase/GenerateSchemaMarkupUseCase for throwing instead
// of a Result here.
export class GenerateLlmsTxtUseCase {
  constructor(private readonly deps: GenerateLlmsTxtDeps) {}

  async execute(projectId: string, crawlJobId: string): Promise<LlmsTxtFile> {
    const project = await this.deps.projectRepository.findById(projectId);
    if (!project) {
      throw new Error(`Project "${projectId}" not found while generating llms.txt`);
    }

    const pages = await this.deps.pageRepository.findAllByCrawlJobId(crawlJobId);
    const content = renderLlmsTxt(project.name, pages);
    const pageCount = pages.filter(isLlmsTxtEligible).length;

    const llmsTxtFile = LlmsTxtFile.create(projectId, content, pageCount);
    await this.deps.llmsTxtRepository.save(llmsTxtFile);

    return llmsTxtFile;
  }
}
