import type { SitemapFile } from "@/domain/sitemap/entities/sitemap-file";

export interface SitemapFileDto {
  id: string;
  projectId: string;
  content: string;
  pageCount: number;
  generatedAt: string;
}

export function toSitemapFileDto(sitemapFile: SitemapFile): SitemapFileDto {
  return {
    id: sitemapFile.id,
    projectId: sitemapFile.projectId,
    content: sitemapFile.content,
    pageCount: sitemapFile.pageCount,
    generatedAt: sitemapFile.generatedAt.toISOString(),
  };
}
