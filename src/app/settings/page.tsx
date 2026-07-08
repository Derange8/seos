import { LlmSettingsForm } from "@/components/llm-settings-form";
import { LlmCredentialsForm } from "@/components/llm-credentials-form";
import { AppShell } from "@/components/app-shell";

export default function SettingsPage() {
  return (
    <AppShell active="settings">
      <div className="flex max-w-2xl flex-col gap-8">
        <header className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
          <p className="text-sm text-muted-foreground">
            Configure the AI provider for content, and the engines to measure your visibility on.
          </p>
        </header>

        <LlmSettingsForm />
        <LlmCredentialsForm />
      </div>
    </AppShell>
  );
}
