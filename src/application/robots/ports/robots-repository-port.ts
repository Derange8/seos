import type { RobotsFile } from "@/domain/robots/entities/robots-file";

export interface RobotsRepositoryPort {
  save(robotsFile: RobotsFile): Promise<void>;
  findLatestByProjectId(projectId: string): Promise<RobotsFile | null>;
}
