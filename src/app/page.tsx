import { prisma } from "@/infrastructure/persistence/prisma/prisma-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CreateProjectForm } from "@/components/create-project-form";
import { ProjectList } from "@/components/project-list";
import { AppShell } from "@/components/app-shell";

// Must never be statically prerendered: the desktop app is built once but
// runs against a different local SQLite file per install/launch, so a
// build-time snapshot of which projects exist would be wrong for every
// user except whoever happened to run the build.
export const dynamic = "force-dynamic";

// Doubles as the project switcher — always lists every site rather than
// auto-redirecting into "the" project, since multiple sites are supported
// and this is also the only place to disconnect one (see project-list.tsx).
export default async function Home() {
  const projects = await prisma.project.findMany({ orderBy: { createdAt: "asc" } });
  const hasProjects = projects.length > 0;

  return (
    <AppShell active="sites">
      <div className="flex flex-col gap-8">
        <header className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Sites</h1>
          <p className="text-sm text-muted-foreground">
            {hasProjects
              ? "Measure and grow how AI assistants recommend each of your sites."
              : "Connect your first site to see how AI assistants recommend it."}
          </p>
        </header>

        {hasProjects && (
          <ProjectList
            projects={projects.map((project) => ({
              id: project.id,
              name: project.name,
              domain: project.domain,
              isVerified: project.domainVerifiedAt !== null,
            }))}
          />
        )}

        <Card className="max-w-xl">
          <CardHeader>
            <CardTitle>{hasProjects ? "Add another site" : "Set up your site"}</CardTitle>
          </CardHeader>
          <CardContent>
            <CreateProjectForm />
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
