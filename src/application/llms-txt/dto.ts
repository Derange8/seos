import type { LlmsTxtFile } from "@/domain/llms-txt/entities/llms-txt-file";

export interface LlmsTxtFileDto {
  id: string;
  projectId: string;
  content: string;
  pageCount: number;
  generatedAt: string;
}

export function toLlmsTxtFileDto(llmsTxtFile: LlmsTxtFile): LlmsTxtFileDto {
  return {
    id: llmsTxtFile.id,
    projectId: llmsTxtFile.projectId,
    content: llmsTxtFile.content,
    pageCount: llmsTxtFile.pageCount,
    generatedAt: llmsTxtFile.generatedAt.toISOString(),
  };
}
