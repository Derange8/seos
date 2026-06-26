import type { Project } from "@/domain/projects/entities/project";

export interface ProjectDto {
  id: string;
  name: string;
  domain: string;
  isVerified: boolean;
  domainVerifiedAt: string | null;
  verificationToken: string;
  dnsTxtRecordName: string;
  wellKnownFileUrl: string;
  autoPilotEnabled: boolean;
}

export function toProjectDto(project: Project): ProjectDto {
  return {
    id: project.id,
    name: project.name,
    domain: project.domain.value,
    isVerified: project.isVerified,
    domainVerifiedAt: project.domainVerifiedAt?.toISOString() ?? null,
    verificationToken: project.verificationToken,
    dnsTxtRecordName: project.dnsTxtRecordName,
    wellKnownFileUrl: project.wellKnownFileUrl,
    autoPilotEnabled: project.autoPilotEnabled,
  };
}
