import type { Project } from "@/domain/projects/entities/project";

export interface ProjectRepositoryPort {
  save(project: Project): Promise<void>;
  findById(id: string): Promise<Project | null>;
  // Used by CreateProjectUseCase to reject a duplicate domain — a project's
  // domain is the thing that must be unique, not "is there a project at all"
  // (multiple projects/sites are supported).
  findByDomain(domain: string): Promise<Project | null>;
  // Project switcher (src/app/page.tsx) and the Google tracking scheduler,
  // which now iterates every project rather than assuming just one.
  findAll(): Promise<Project[]>;
  // The "disconnect/start over" affordance — cascades to that project's
  // crawl jobs, pages, audit runs, WordPress/Google connections, etc. (see
  // schema.prisma's onDelete: Cascade relations on Project).
  delete(id: string): Promise<void>;
}
