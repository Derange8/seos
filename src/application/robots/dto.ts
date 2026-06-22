import type { RobotsFile } from "@/domain/robots/entities/robots-file";

export interface RobotsFileDto {
  id: string;
  projectId: string;
  content: string;
  generatedAt: string;
}

export function toRobotsFileDto(robotsFile: RobotsFile): RobotsFileDto {
  return {
    id: robotsFile.id,
    projectId: robotsFile.projectId,
    content: robotsFile.content,
    generatedAt: robotsFile.generatedAt.toISOString(),
  };
}
