import type { AuditIssueDto, AuditRunDto } from "@/application/auditing/dto";
import type { FixCandidateDto } from "@/application/fixes/dto";

function formatIssueLines(
  issue: AuditIssueDto,
  index: number,
  fixCandidates: readonly FixCandidateDto[]
): string {
  const fix = fixCandidates.find((candidate) => candidate.auditIssueId === issue.id);
  const lines = [`${index + 1}. [${issue.severity}] ${issue.ruleId} — ${issue.message}`];
  if (issue.recommendation) lines.push(`   Recommendation: ${issue.recommendation}`);
  if (fix) lines.push(`   Suggested fix (${fix.type}): ${fix.content}`);
  return lines.join("\n");
}

// Plain-text export of every issue in one audit run, in the same
// best-to-act-on-first order the dashboard already shows them in (see
// toAuditRunDto) — meant to be pasted into a doc, a ticket, or an LLM in
// one shot instead of copying each issue's fix individually.
//
// Issues sharing both a ruleId and a routeTemplate (e.g. 12 /post/[id]
// instances all missing a canonical tag) collapse into one summary line
// instead of 12 near-identical numbered entries — same grouping the
// dashboard applies, so copying this report doesn't lose the "fix the
// template once" framing.
export function formatAuditReport(
  domain: string,
  auditRun: AuditRunDto,
  fixCandidates: readonly FixCandidateDto[]
): string {
  const header = `Seos Audit Report — ${domain} — Score: ${auditRun.overallScore ?? "N/A"}/100 — ${auditRun.issues.length} issue${auditRun.issues.length === 1 ? "" : "s"}`;

  const templateGroupKey = new Map<string, string>();
  const countByGroupKey = new Map<string, number>();
  for (const issue of auditRun.issues) {
    if (!issue.routeTemplate) continue;
    const key = `${issue.ruleId}::${issue.routeTemplate}`;
    templateGroupKey.set(issue.id, key);
    countByGroupKey.set(key, (countByGroupKey.get(key) ?? 0) + 1);
  }

  const seenGroupKeys = new Set<string>();
  let entryNumber = 0;
  const entries: string[] = [];

  for (const issue of auditRun.issues) {
    const groupKey = templateGroupKey.get(issue.id);
    const groupSize = groupKey ? countByGroupKey.get(groupKey)! : 1;

    if (groupSize <= 1) {
      entryNumber += 1;
      entries.push(formatIssueLines(issue, entryNumber - 1, fixCandidates));
      continue;
    }

    if (seenGroupKeys.has(groupKey!)) continue;
    seenGroupKeys.add(groupKey!);

    const groupIssues = auditRun.issues.filter((candidate) => templateGroupKey.get(candidate.id) === groupKey);
    const exampleUrls = groupIssues
      .slice(0, 3)
      .map((candidate) => candidate.pageUrl)
      .filter((url): url is string => Boolean(url));
    entryNumber += 1;
    entries.push(
      `${entryNumber}. [${issue.severity}] ${issue.ruleId} — ${issue.routeTemplate} (${groupSize} pages, e.g. ${exampleUrls.join(", ")}${groupSize > exampleUrls.length ? ", …" : ""}) — ${issue.message}`
    );
  }

  const body = entries.join("\n\n");

  return auditRun.issues.length > 0 ? `${header}\n\n${body}` : header;
}
