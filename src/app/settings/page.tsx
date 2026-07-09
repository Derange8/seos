import { SettingsContent } from "@/components/settings-content";
import { AppShell } from "@/components/app-shell";

export default function SettingsPage() {
  return (
    <AppShell active="settings">
      <SettingsContent />
    </AppShell>
  );
}
