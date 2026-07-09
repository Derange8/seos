"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { LlmSettingsDto } from "@/application/settings/dto";
import { useLanguage } from "@/hooks/use-language";
import { TRANSLATIONS, type TranslationKey } from "@/components/project-dashboard/shared";

const PROVIDER_LABEL: Record<string, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic (Claude)",
  deepseek: "DeepSeek",
  gemini: "Gemini (Google)",
};

export function LlmSettingsForm() {
  const [language] = useLanguage();
  const t = (key: TranslationKey) => TRANSLATIONS[key][language];
  const [settings, setSettings] = useState<LlmSettingsDto | null>(null);
  const [provider, setProvider] = useState("openai");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/v1/settings/llm")
      .then((response) => response.json())
      .then((data: LlmSettingsDto | null) => {
        setSettings(data);
        if (data) {
          setProvider(data.provider);
          setModel(data.model ?? "");
        }
      })
      .catch((err: unknown) => console.error("Failed to fetch LLM settings", err));
  }, []);

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    setIsSaving(true);
    setError(null);

    let response: Response;
    try {
      response = await fetch("/api/v1/settings/llm", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ provider, apiKey, model: model.trim() || null }),
      });
    } catch {
      setIsSaving(false);
      setError(t("networkErrorRetry"));
      return;
    }

    const data = await response.json();
    setIsSaving(false);
    if (!response.ok) {
      setError(data.error ?? t("failedToSaveSettings"));
      return;
    }
    setSettings(data);
    setApiKey("");
  }

  async function handleRemove() {
    setIsRemoving(true);
    try {
      await fetch("/api/v1/settings/llm", { method: "DELETE" });
      setSettings(null);
      setApiKey("");
      setModel("");
    } catch (err: unknown) {
      console.error("Failed to remove LLM settings", err);
    } finally {
      setIsRemoving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("aiProviderTitle")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 text-sm">
        <p className="text-muted-foreground">
          {settings ? (
            <>
              {t("configuredLabel")}{" "}
              <span className="font-medium text-foreground">{PROVIDER_LABEL[settings.provider] ?? settings.provider}</span>
              {settings.model ? ` (${settings.model})` : ""}
            </>
          ) : (
            t("notConfiguredHint")
          )}
        </p>

        <form onSubmit={handleSave} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="provider">{t("provider")}</Label>
            <div className="relative">
              <select
                id="provider"
                value={provider}
                onChange={(event) => setProvider(event.target.value)}
                className="h-8 w-full appearance-none rounded-lg border border-input bg-transparent px-2.5 pr-8 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
              >
                <option value="openai">OpenAI</option>
                <option value="anthropic">Anthropic (Claude)</option>
                <option value="deepseek">DeepSeek</option>
                <option value="gemini">Gemini (Google)</option>
              </select>
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                aria-hidden
                className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="apiKey">{t("apiKey")}</Label>
            <Input
              id="apiKey"
              type="password"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              placeholder={settings ? t("apiKeyReplaceHint") : "sk-..."}
              required={!settings}
            />
            <p className="text-xs text-muted-foreground">{t("apiKeyStaysHint")}</p>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="model">{t("modelOptional")}</Label>
            <Input
              id="model"
              value={model}
              onChange={(event) => setModel(event.target.value)}
              placeholder={t("modelDefaultHint")}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex gap-2">
            <Button type="submit" disabled={isSaving}>
              {isSaving ? t("saving") : t("saveLabel")}
            </Button>
            {settings && (
              <Button type="button" variant="outline" onClick={handleRemove} disabled={isRemoving}>
                {isRemoving ? t("removing") : t("removeLabel")}
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
