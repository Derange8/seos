import { generateSchemaMarkup } from "@/domain/schema-markup/services/schema-generator";
import type { SchemaMarkup } from "@/domain/schema-markup/entities/schema-markup";
import type { SchemaMarkupRepositoryPort } from "@/application/schema-markup/ports/schema-markup-repository-port";
import type { PageRepositoryPort } from "@/application/crawling/ports/page-repository-port";
import type { ProjectRepositoryPort } from "@/application/projects/ports/project-repository-port";

export interface GenerateSchemaMarkupDeps {
  pageRepository: PageRepositoryPort;
  projectRepository: ProjectRepositoryPort;
  schemaMarkupRepository: SchemaMarkupRepositoryPort;
}

// Only reachable from CrawlJobCompleted, where projectId is guaranteed to
// reference a real project by construction — a missing project here is a
// genuine invariant violation, not a recoverable outcome a caller branches
// on, so this throws rather than returning a Result (same reasoning as
// RunAuditUseCase/GenerateSitemapUseCase having no Result wrapper).
export class GenerateSchemaMarkupUseCase {
  constructor(private readonly deps: GenerateSchemaMarkupDeps) {}

  async execute(projectId: string, crawlJobId: string): Promise<SchemaMarkup[]> {
    const project = await this.deps.projectRepository.findById(projectId);
    if (!project) {
      throw new Error(`Project "${projectId}" not found while generating schema markup`);
    }

    const pages = await this.deps.pageRepository.findAllByCrawlJobId(crawlJobId);
    const markup = generateSchemaMarkup(pages, project.name);

    await this.deps.schemaMarkupRepository.saveMany(markup);
    return markup;
  }
}
