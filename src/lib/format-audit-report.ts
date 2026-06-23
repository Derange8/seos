import type { AuditRunDto } from "@/application/auditing/dto";
import type { FixCandidateDto } from "@/application/fixes/dto";

// Plain-text export of every issue in one audit run, in the same
// best-to-act-on-first order the dashboard already shows them in (see
// toAuditRunDto) — meant to be pasted into a doc, a ticket, or an LLM in
// one shot instead of copying each issue's fix individually.
export function formatAuditReport(
  domain: string,
  auditRun: AuditRunDto,
  fixCandidates: readonly FixCandidateDto[]
): string {
  const header = `Seos Audit Report — ${domain} — Score: ${auditRun.overallScore ?? "N/A"}/100 — ${auditRun.issues.length} issue${auditRun.issues.length === 1 ? "" : "s"}`;

  const body = auditRun.issues
    .map((issue, index) => {
      const fix = fixCandidates.find((candidate) => candidate.auditIssueId === issue.id);
      const lines = [`${index + 1}. [${issue.severity}] ${issue.ruleId} — ${issue.message}`];
      if (issue.recommendation) lines.push(`   Recommendation: ${issue.recommendation}`);
      if (fix) lines.push(`   Suggested fix (${fix.type}): ${fix.content}`);
      return lines.join("\n");
    })
    .join("\n\n");

  return auditRun.issues.length > 0 ? `${header}\n\n${body}` : header;
}
