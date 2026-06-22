import { SitemapFile } from "@/domain/sitemap/entities/sitemap-file";
import { renderSitemapXml, selectSitemapEntries } from "@/domain/sitemap/services/sitemap-generator";
import type { SitemapRepositoryPort } from "@/application/sitemap/ports/sitemap-repository-port";
import type { PageRepositoryPort } from "@/application/crawling/ports/page-repository-port";

export interface GenerateSitemapDeps {
  pageRepository: PageRepositoryPort;
  sitemapRepository: SitemapRepositoryPort;
}

// No expected-failure branch (same reasoning as RunAuditUseCase) — a crawl
// job with zero eligible pages just produces an empty-but-valid sitemap.
export class GenerateSitemapUseCase {
  constructor(private readonly deps: GenerateSitemapDeps) {}

  async execute(projectId: string, crawlJobId: string): Promise<SitemapFile> {
    const pages = await this.deps.pageRepository.findAllByCrawlJobId(crawlJobId);
    const entries = selectSitemapEntries(pages);
    const xml = renderSitemapXml(entries);

    const sitemapFile = SitemapFile.create(projectId, xml, entries.length);
    await this.deps.sitemapRepository.save(sitemapFile);

    return sitemapFile;
  }
}
