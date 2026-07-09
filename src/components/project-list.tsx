"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useLanguage } from "@/hooks/use-language";
import { TRANSLATIONS, type TranslationKey } from "@/components/project-dashboard/shared";

export interface ProjectListItem {
  id: string;
  name: string;
  domain: string;
  isVerified: boolean;
}

export function ProjectList({ projects }: { projects: ProjectListItem[] }) {
  const router = useRouter();
  const [language] = useLanguage();
  const t = (key: TranslationKey) => TRANSLATIONS[key][language];
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleDisconnect(project: ProjectListItem) {
    const confirmed = window.confirm(t("disconnectConfirm").replace("{domain}", project.domain));
    if (!confirmed) return;

    setError(null);
    setPendingId(project.id);
    const response = await fetch(`/api/v1/projects/${project.id}`, { method: "DELETE" });
    setPendingId(null);

    if (!response.ok) {
      setError(`${t("failedToDisconnect")} "${project.domain}"`);
      return;
    }
    router.refresh();
  }

  // Verified sites first — they carry real measurement history; unverified are
  // still in setup.
  const sorted = [...projects].sort((a, b) => Number(b.isVerified) - Number(a.isVerified));

  return (
    <div className="flex w-full flex-col gap-4">
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {sorted.map((project) => (
          <Card
            key={project.id}
            className="group transition-all duration-200 hover:-translate-y-1 hover:border-white/25 hover:shadow-[0_16px_40px_-12px_oklch(0_0_0_/_45%)]"
          >
            <CardContent className="flex flex-col gap-4 py-5">
              <div className="flex items-start justify-between gap-3">
                <Link href={`/projects/${project.id}`} className="min-w-0 flex-1">
                  <p className="truncate text-base font-semibold tracking-tight">{project.name}</p>
                  <p className="truncate text-sm text-muted-foreground">{project.domain}</p>
                </Link>
                <Badge
                  variant={project.isVerified ? "default" : "secondary"}
                  className="shrink-0"
                >
                  {project.isVerified ? t("verified") : t("setupBadge")}
                </Badge>
              </div>
              <div className="flex items-center justify-between gap-2 border-t border-white/8 pt-3">
                <Link
                  href={`/projects/${project.id}`}
                  className="text-sm font-medium text-muted-foreground transition-colors group-hover:text-primary"
                >
                  {t("openDashboard")}
                </Link>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={pendingId === project.id}
                  onClick={() => handleDisconnect(project)}
                  className="text-muted-foreground hover:text-destructive"
                >
                  {pendingId === project.id ? t("disconnecting") : t("disconnect")}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
