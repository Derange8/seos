import { prisma } from "@/infrastructure/persistence/prisma/prisma-client";
import { SitesContent } from "@/components/sites-content";
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

  return (
    <AppShell active="sites">
      <SitesContent
        projects={projects.map((project) => ({
          id: project.id,
          name: project.name,
          domain: project.domain,
          isVerified: project.domainVerifiedAt !== null,
        }))}
      />
    </AppShell>
  );
}
