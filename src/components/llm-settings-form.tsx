"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { LlmSettingsDto } from "@/application/settings/dto";

const PROVIDER_LABEL: Record<string, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic (Claude)",
  deepseek: "DeepSeek",
};

export function LlmSettingsForm() {
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
      setError("Network error — check your connection and try again.");
      return;
    }

    const data = await response.json();
    setIsSaving(false);
    if (!response.ok) {
      setError(data.error ?? "Failed to save settings");
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
        <CardTitle>AI Provider</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 text-sm">
        <p className="text-muted-foreground">
          {settings ? (
            <>
              Configured: <span className="font-medium text-foreground">{PROVIDER_LABEL[settings.provider] ?? settings.provider}</span>
              {settings.model ? ` (${settings.model})` : ""}
            </>
          ) : (
            "Not configured — audit recommendations use free, template-based text until a key is added here."
          )}
        </p>

        <form onSubmit={handleSave} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="provider">Provider</Label>
            <select
              id="provider"
              value={provider}
              onChange={(event) => setProvider(event.target.value)}
              className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <option value="openai">OpenAI</option>
              <option value="anthropic">Anthropic (Claude)</option>
              <option value="deepseek">DeepSeek</option>
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="apiKey">API Key</Label>
            <Input
              id="apiKey"
              type="password"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              placeholder={settings ? "Enter a new key to replace the saved one" : "sk-..."}
              required={!settings}
            />
            <p className="text-xs text-muted-foreground">
              Stays on this computer, encrypted at rest — never sent anywhere except the provider you pick above.
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="model">Model (optional)</Label>
            <Input
              id="model"
              value={model}
              onChange={(event) => setModel(event.target.value)}
              placeholder="Defaults to a sensible model for the provider"
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex gap-2">
            <Button type="submit" disabled={isSaving}>
              {isSaving ? "Saving…" : "Save"}
            </Button>
            {settings && (
              <Button type="button" variant="outline" onClick={handleRemove} disabled={isRemoving}>
                {isRemoving ? "Removing…" : "Remove"}
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
