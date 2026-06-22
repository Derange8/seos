import { RobotsFile } from "@/domain/robots/entities/robots-file";
import { renderRobotsTxt } from "@/domain/robots/services/robots-generator";
import type { DomainName } from "@/domain/projects/value-objects/domain-name";
import type { RobotsRepositoryPort } from "@/application/robots/ports/robots-repository-port";

export interface GetOrGenerateRobotsFileDeps {
  robotsRepository: RobotsRepositoryPort;
}

// Unlike AuditRun/SitemapFile, there's no "per crawl" axis here — content
// is a pure function of the project's domain, which never changes after
// creation. So this acts as a cache: the first call generates and persists,
// every call after returns the same row instead of growing a pointless
// history of byte-identical rows.
export class GetOrGenerateRobotsFileUseCase {
  constructor(private readonly deps: GetOrGenerateRobotsFileDeps) {}

  async execute(projectId: string, domain: DomainName): Promise<RobotsFile> {
    const existing = await this.deps.robotsRepository.findLatestByProjectId(projectId);
    if (existing) return existing;

    const robotsFile = RobotsFile.create(projectId, renderRobotsTxt(domain));
    await this.deps.robotsRepository.save(robotsFile);
    return robotsFile;
  }
}
