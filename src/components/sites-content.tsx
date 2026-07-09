"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CreateProjectForm } from "@/components/create-project-form";
import { ProjectList, type ProjectListItem } from "@/components/project-list";
import { useLanguage } from "@/hooks/use-language";
import { TRANSLATIONS, type TranslationKey } from "@/components/project-dashboard/shared";

// Client wrapper around the Sites page body — split out from the server
// component in app/page.tsx purely so it can read the global useLanguage
// store (a client-only hook) and render this screen in the selected
// language, same as every other screen.
export function SitesContent({ projects }: { projects: ProjectListItem[] }) {
  const [language] = useLanguage();
  const t = (key: TranslationKey) => TRANSLATIONS[key][language];
  const hasProjects = projects.length > 0;

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-1.5">
        <h1 className="text-3xl font-semibold tracking-tight">{t("sitesTitle")}</h1>
        <p className="text-base text-muted-foreground">
          {hasProjects ? t("sitesSubtitleWithProjects") : t("sitesSubtitleEmpty")}
        </p>
      </header>

      {hasProjects ? (
        <>
          <ProjectList projects={projects} />

          {/* Deliberately quieter than the site grid above it — this is a
              secondary action once at least one site exists, not the
              primary thing on the page anymore. */}
          <Card className="max-w-xl" size="sm">
            <CardHeader>
              <CardTitle className="text-sm">{t("addAnotherSite")}</CardTitle>
            </CardHeader>
            <CardContent>
              <CreateProjectForm />
            </CardContent>
          </Card>
        </>
      ) : (
        // First-run empty state: the primary action gets real visual
        // weight (centered, an icon, a two-line pitch) instead of reusing
        // the same passive card that "add another site" uses once sites
        // already exist — this is the highest-leverage screen a new user sees.
        <div className="glass-card flex flex-col items-center gap-6 rounded-3xl px-8 py-16 text-center">
          <span className="grid size-14 place-items-center rounded-2xl bg-gradient-to-br from-primary to-[oklch(0.7_0.16_240)] text-primary-foreground shadow-[0_4px_20px_-4px_oklch(0.7_0.19_290_/_60%)]">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="size-7">
              <circle cx="12" cy="12" r="9" />
              <path d="M3 12h18M12 3c2.5 2.6 3.8 5.7 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.7-3.8-9s1.3-6.4 3.8-9Z" />
            </svg>
          </span>
          <div className="flex max-w-sm flex-col gap-1.5">
            <h2 className="text-lg font-semibold tracking-tight">{t("setUpFirstSite")}</h2>
            <p className="text-sm text-muted-foreground">{t("setUpFirstSiteDescription")}</p>
          </div>
          <div className="w-full max-w-xs text-left">
            <CreateProjectForm />
          </div>
        </div>
      )}
    </div>
  );
}
