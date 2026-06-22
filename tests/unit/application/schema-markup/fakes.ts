import type { SchemaMarkupRepositoryPort } from "@/application/schema-markup/ports/schema-markup-repository-port";
import type { SchemaMarkup } from "@/domain/schema-markup/entities/schema-markup";

export class FakeSchemaMarkupRepository implements SchemaMarkupRepositoryPort {
  readonly saved: SchemaMarkup[] = [];

  async saveMany(schemaMarkups: readonly SchemaMarkup[]): Promise<void> {
    this.saved.push(...schemaMarkups);
  }

  async findAllByCrawlJobId(crawlJobId: string): Promise<SchemaMarkup[]> {
    // pageId isn't enough on its own to derive crawlJobId in this fake, so
    // tests that need findAllByCrawlJobId to be meaningful seed `saved`
    // through saveMany() per-test and only ever exercise one crawl job at a
    // time, mirroring FakePageRepository's same simplification.
    void crawlJobId;
    return [...this.saved];
  }
}
