import { prisma } from "@/infrastructure/persistence/prisma/prisma-client";

export type ProjectAccessResult = { error: "NOT_FOUND" } | { error: null };

// Desktop program, no accounts — this just confirms the project id in the
// URL actually exists (a stale/garbage id still needs a 404, not a crash
// further down the route). Not a real authorization check: any project id
// is "accessible" to whoever is running the app locally.
export async function requireProjectAccess(projectId: string): Promise<ProjectAccessResult> {
  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { id: true } });
  if (!project) return { error: "NOT_FOUND" };
  return { error: null };
}
