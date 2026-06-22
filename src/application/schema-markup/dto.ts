import type { SchemaMarkup } from "@/domain/schema-markup/entities/schema-markup";

export interface SchemaMarkupDto {
  id: string;
  pageId: string;
  type: string;
  jsonLd: Record<string, unknown>;
  source: string;
  status: string;
}

export function toSchemaMarkupDto(schemaMarkup: SchemaMarkup): SchemaMarkupDto {
  return {
    id: schemaMarkup.id,
    pageId: schemaMarkup.pageId,
    type: schemaMarkup.type,
    jsonLd: schemaMarkup.jsonLd,
    source: schemaMarkup.source,
    status: schemaMarkup.status,
  };
}
