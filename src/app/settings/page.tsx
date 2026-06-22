import Link from "next/link";
import { LlmSettingsForm } from "@/components/llm-settings-form";

export default function SettingsPage() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8 px-6 py-12">
      <div>
        <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
          ← Back
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Settings</h1>
      </div>

      <LlmSettingsForm />
    </div>
  );
}
