import type { AuditCategory } from "@/domain/auditing/entities/audit-issue";

export interface SeoScoreProps {
  id: string;
  auditRunId: string;
  // null = site-level (averaged across every crawled page); set = scoped
  // to a single page.
  pageId: string | null;
  category: AuditCategory;
  score: number;
}

// Generated artifact, not an aggregate root — same reasoning as
// SitemapFile/RobotsFile/SchemaMarkup. Always created fresh by
// CalculateSeoScoresUseCase alongside a finished AuditRun, never mutated
// afterward.
export class SeoScore {
  private constructor(private readonly props: SeoScoreProps) {}

  static create(auditRunId: string, pageId: string | null, category: AuditCategory, score: number): SeoScore {
    return new SeoScore({ id: crypto.randomUUID(), auditRunId, pageId, category, score });
  }

  static reconstitute(props: SeoScoreProps): SeoScore {
    return new SeoScore(props);
  }

  get id(): string {
    return this.props.id;
  }

  get auditRunId(): string {
    return this.props.auditRunId;
  }

  get pageId(): string | null {
    return this.props.pageId;
  }

  get category(): AuditCategory {
    return this.props.category;
  }

  get score(): number {
    return this.props.score;
  }

  get isSiteLevel(): boolean {
    return this.props.pageId === null;
  }
}
