import type { SchemaMarkup } from "@/domain/schema-markup/entities/schema-markup";

export interface SchemaMarkupRepositoryPort {
  saveMany(schemaMarkups: readonly SchemaMarkup[]): Promise<void>;
  findAllByCrawlJobId(crawlJobId: string): Promise<SchemaMarkup[]>;
}
