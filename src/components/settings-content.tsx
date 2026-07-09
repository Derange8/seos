"use client";

import { LlmSettingsForm } from "@/components/llm-settings-form";
import { LlmCredentialsForm } from "@/components/llm-credentials-form";
import { useLanguage } from "@/hooks/use-language";
import { TRANSLATIONS, type TranslationKey } from "@/components/project-dashboard/shared";

export function SettingsContent() {
  const [language] = useLanguage();
  const t = (key: TranslationKey) => TRANSLATIONS[key][language];

  return (
    <div className="flex max-w-2xl flex-col gap-8">
      <header className="flex flex-col gap-1.5">
        <h1 className="text-3xl font-semibold tracking-tight">{t("settingsTitle")}</h1>
        <p className="text-base text-muted-foreground">{t("settingsSubtitle")}</p>
      </header>

      <LlmSettingsForm />
      <LlmCredentialsForm />
    </div>
  );
}
