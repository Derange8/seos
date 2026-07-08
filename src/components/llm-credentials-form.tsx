"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
      setError("Network error — check your connection and try again.");
      return;
    }
    const data = await response.json().catch(() => ({}));
    setIsSaving(false);
    if (!response.ok) {
      setError(data.error ?? "Failed to save this engine's key");
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
        <CardTitle>Measurement engines</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 text-sm">
        <p className="text-muted-foreground">
          Add a key for each AI engine you want to measure on. One &quot;Measure&quot; then probes all of them and
          compares your visibility side by side — a site recommended on ChatGPT can be invisible on Gemini.
        </p>

        {state.configured.length > 0 && (
          <ul className="flex flex-col gap-1.5">
            {state.configured.map((p) => (
              <li key={p} className="flex items-center justify-between gap-2 rounded-md border border-white/10 bg-black/20 px-3 py-1.5">
                <span className="font-medium">{ENGINE_LABEL[p] ?? p}</span>
                <Button variant="outline" size="sm" onClick={() => handleRemove(p)} disabled={busyRemove === p}>
                  {busyRemove === p ? "Removing…" : "Remove"}
                </Button>
              </li>
            ))}
          </ul>
        )}

        <form onSubmit={handleSave} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="engine">Engine</Label>
            <select
              id="engine"
              value={engine}
              onChange={(event) => setEngine(event.target.value)}
              className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {state.available.map((p) => (
                <option key={p} value={p}>
                  {ENGINE_LABEL[p] ?? p}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="engineKey">API Key</Label>
            <Input
              id="engineKey"
              type="password"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              placeholder={state.configured.includes(engine) ? "Enter a new key to replace the saved one" : "Enter this engine's API key"}
              required
            />
            <p className="text-xs text-muted-foreground">Stored on this computer, encrypted at rest.</p>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? "Saving…" : state.configured.includes(engine) ? "Update key" : "Add engine"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
