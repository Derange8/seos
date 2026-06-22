import type { SitemapRepositoryPort } from "@/application/sitemap/ports/sitemap-repository-port";
import type { SitemapFile } from "@/domain/sitemap/entities/sitemap-file";

export class FakeSitemapRepository implements SitemapRepositoryPort {
  readonly saved: SitemapFile[] = [];

  async save(sitemapFile: SitemapFile): Promise<void> {
    this.saved.push(sitemapFile);
  }

  async findLatestByProjectId(projectId: string): Promise<SitemapFile | null> {
    const matches = this.saved.filter((file) => file.projectId === projectId);
    return matches.sort((a, b) => b.generatedAt.getTime() - a.generatedAt.getTime())[0] ?? null;
  }
}
