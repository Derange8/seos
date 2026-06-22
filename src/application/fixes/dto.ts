import type { FixCandidate } from "@/domain/fixes/entities/fix-candidate";

export interface FixCandidateDto {
  id: string;
  auditIssueId: string;
  pageId: string;
  type: string;
  content: string;
  source: string;
  status: string;
  previousValue: string | null;
  createdAt: string;
}

export function toFixCandidateDto(fixCandidate: FixCandidate): FixCandidateDto {
  return {
    id: fixCandidate.id,
    auditIssueId: fixCandidate.auditIssueId,
    pageId: fixCandidate.pageId,
    type: fixCandidate.type,
    content: fixCandidate.content,
    source: fixCandidate.source,
    status: fixCandidate.status,
    previousValue: fixCandidate.previousValue,
    createdAt: fixCandidate.createdAt.toISOString(),
  };
}
