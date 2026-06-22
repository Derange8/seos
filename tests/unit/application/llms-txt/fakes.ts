import type { LlmsTxtRepositoryPort } from "@/application/llms-txt/ports/llms-txt-repository-port";
import type { LlmsTxtFile } from "@/domain/llms-txt/entities/llms-txt-file";

export class FakeLlmsTxtRepository implements LlmsTxtRepositoryPort {
  readonly saved: LlmsTxtFile[] = [];

  async save(llmsTxtFile: LlmsTxtFile): Promise<void> {
    this.saved.push(llmsTxtFile);
  }

  async findLatestByProjectId(projectId: string): Promise<LlmsTxtFile | null> {
    const matches = this.saved.filter((file) => file.projectId === projectId);
    return matches.sort((a, b) => b.generatedAt.getTime() - a.generatedAt.getTime())[0] ?? null;
  }
}
