import type { LlmSettings } from "@/domain/settings/entities/llm-settings";

export interface LlmSettingsDto {
  provider: string;
  model: string | null;
  updatedAt: string;
}

// apiKey is deliberately never included here — it must never round-trip
// back to the client, encrypted-at-rest or not (same rule as
// WordPressConnectionDto's applicationPassword).
export function toLlmSettingsDto(settings: LlmSettings): LlmSettingsDto {
  return {
    provider: settings.provider,
    model: settings.model,
    updatedAt: settings.updatedAt.toISOString(),
  };
}
