import type { LlmSettings } from "@/domain/settings/entities/llm-settings";

export interface LlmSettingsRepositoryPort {
  save(settings: LlmSettings): Promise<void>;
  find(): Promise<LlmSettings | null>;
  clear(): Promise<void>;
}
