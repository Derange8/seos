import type { SitemapFile } from "@/domain/sitemap/entities/sitemap-file";

export interface SitemapRepositoryPort {
  save(sitemapFile: SitemapFile): Promise<void>;
  findLatestByProjectId(projectId: string): Promise<SitemapFile | null>;
}
