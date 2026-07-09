"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/hooks/use-language";
import { TRANSLATIONS, type TranslationKey } from "@/components/project-dashboard/shared";

const ENGINE_LABEL: Record<string, string> = {
  openai: "OpenAI (ChatGPT)",
  anthropic: "Anthropic (Claude)",
  gemini: "Gemini (Google)",
};

interface CredentialsState {
  configured: string[];
  available: string[];
}

// Manages the per-engine measurement keys (Faz 5.5) — separate from the single
// "AI Provider" used for audit/content. Having keys for several engines lets a
// probe measure and compare them side by side.
export function LlmCredentialsForm() {
  const [language] = useLanguage();
  const t = (key: TranslationKey) => TRANSLATIONS[key][language];
  const [state, setState] = useState<CredentialsState>({ configured: [], available: [] });
  const [engine, setEngine] = useState("openai");
  const [apiKey, setApiKey] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [busyRemove, setBusyRemove] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function refresh() {
    fetch("/api/v1/settings/llm-credentials")
      .then((r) => r.json())
      .then((data: CredentialsState) => {
        setState(data);
        if (data.available.length > 0 && !data.available.includes(engine)) setEngine(data.available[0]);
      })
      .catch((err: unknown) => console.error("Failed to fetch measurement credentials", err));
  }

  useEffect(refresh, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    setIsSaving(true);
    setError(null);
    let response: Response;
    try {
      response = await fetch("/api/v1/settings/llm-credentials", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ provider: engine, apiKey }),
      });
    } catch {
      setIsSaving(false);
      setError(t("networkErrorRetry"));
      return;
    }
    const data = await response.json().catch(() => ({}));
    setIsSaving(false);
    if (!response.ok) {
      setError(data.error ?? t("failedToSaveEngineKey"));
      return;
    }
    setApiKey("");
    refresh();
  }

  async function handleRemove(provider: string) {
    setBusyRemove(provider);
    try {
      await fetch(`/api/v1/settings/llm-credentials?provider=${encodeURIComponent(provider)}`, { method: "DELETE" });
      refresh();
    } catch (err: unknown) {
      console.error("Failed to remove engine key", err);
    } finally {
      setBusyRemove(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("measurementEnginesTitle")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 text-sm">
        <p className="text-muted-foreground">{t("measurementEnginesDescription")}</p>

        {state.configured.length > 0 && (
          <ul className="flex flex-col gap-2">
            {state.configured.map((p) => (
              <li key={p} className="inset-panel flex items-center justify-between gap-2 rounded-lg px-3.5 py-2.5">
                <span className="flex items-center gap-2 font-medium">
                  <span className="size-1.5 shrink-0 rounded-full bg-success" aria-hidden />
                  {ENGINE_LABEL[p] ?? p}
                </span>
                <Button variant="ghost" size="sm" onClick={() => handleRemove(p)} disabled={busyRemove === p} className="text-muted-foreground hover:text-destructive">
                  {busyRemove === p ? t("removing") : t("removeLabel")}
                </Button>
              </li>
            ))}
          </ul>
        )}

        <form onSubmit={handleSave} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="engine">{t("engine")}</Label>
            <div className="relative">
              <select
                id="engine"
                value={engine}
                onChange={(event) => setEngine(event.target.value)}
                className="h-8 w-full appearance-none rounded-lg border border-input bg-transparent px-2.5 pr-8 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
              >
                {state.available.map((p) => (
                  <option key={p} value={p}>
                    {ENGINE_LABEL[p] ?? p}
                  </option>
                ))}
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
            <Label htmlFor="engineKey">{t("apiKey")}</Label>
            <Input
              id="engineKey"
              type="password"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              placeholder={state.configured.includes(engine) ? t("engineKeyReplaceHint") : t("engineKeyEnterHint")}
              required
            />
            <p className="text-xs text-muted-foreground">{t("storedEncryptedHint")}</p>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? t("saving") : state.configured.includes(engine) ? t("updateKey") : t("addEngine")}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
