import type { LlmsTxtFile } from "@/domain/llms-txt/entities/llms-txt-file";

export interface LlmsTxtRepositoryPort {
  save(llmsTxtFile: LlmsTxtFile): Promise<void>;
  findLatestByProjectId(projectId: string): Promise<LlmsTxtFile | null>;
}
