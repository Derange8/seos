import Link from "next/link";
import { prisma } from "@/infrastructure/persistence/prisma/prisma-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CreateProjectForm } from "@/components/create-project-form";
import { ProjectList } from "@/components/project-list";

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
    <div className="mx-auto flex min-h-screen w-full max-w-xl flex-col items-center gap-10 px-6 py-12">
      <div className="absolute top-6 right-6 flex items-center gap-4 text-sm text-muted-foreground">
        <Link href="/guide" className="hover:text-foreground">
          Guide
        </Link>
        <Link href="/settings" className="hover:text-foreground">
          Settings
        </Link>
      </div>

      <div className="flex flex-col items-center gap-3 text-center">
        <h1 className="bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-4xl font-semibold tracking-tight text-transparent">
          Seos
        </h1>
        <p className="text-sm text-muted-foreground">
          The AI Growth Engineer for your website — become the answer AI assistants recommend, not just another SEO
          score.
        </p>
      </div>

      {projects.length > 0 && (
        <ProjectList
          projects={projects.map((project) => ({
            id: project.id,
            name: project.name,
            domain: project.domain,
            isVerified: project.domainVerifiedAt !== null,
          }))}
        />
      )}

      <Card className="w-full">
        <CardHeader>
          <CardTitle>{projects.length > 0 ? "Add another site" : "Set up your site"}</CardTitle>
        </CardHeader>
        <CardContent>
          <CreateProjectForm />
        </CardContent>
      </Card>
    </div>
  );
}
