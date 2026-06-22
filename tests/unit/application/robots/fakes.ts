import type { RobotsRepositoryPort } from "@/application/robots/ports/robots-repository-port";
import type { RobotsFile } from "@/domain/robots/entities/robots-file";

export class FakeRobotsRepository implements RobotsRepositoryPort {
  readonly saved: RobotsFile[] = [];

  async save(robotsFile: RobotsFile): Promise<void> {
    this.saved.push(robotsFile);
  }

  async findLatestByProjectId(projectId: string): Promise<RobotsFile | null> {
    const matches = this.saved.filter((file) => file.projectId === projectId);
    return matches.sort((a, b) => b.generatedAt.getTime() - a.generatedAt.getTime())[0] ?? null;
  }
}
