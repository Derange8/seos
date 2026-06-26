import type { PageQueryPerformance } from "@/application/tracking/ports/search-console-client-port";
import { CtrUnderperformer } from "@/domain/tracking/entities/ctr-underperformer";

// "Ranking well" — a page outside the top 5 hasn't earned the CTR it
// would get from a prime SERP slot anyway, so a low click-through there
// isn't a title/snippet problem worth flagging.
const TOP_POSITION_THRESHOLD = 5;
// CTR computed from under ~20 impressions moves in coarse, noisy jumps
// (one extra click swings it several points) — too unreliable to compare
// against a benchmark.
const MIN_IMPRESSIONS = 20;
// Flagged only when CTR is less than half what this site's own queries at
// the same rank typically get — a blunt enough bar that it survives the
// inherent noise in a self-calibrated, often small-N benchmark.
const UNDERPERFORMANCE_RATIO = 0.5;

function positionBucket(position: number): number {
  return Math.round(position);
}

// CTR underperformance: a page ranking well (top 5) for a query, with
// enough impressions to trust the number, whose CTR is far below what
// this same site's own queries at a comparable rank typically earn —
// the ranking is fine, the title/meta-description snippet isn't earning
// the clicks it should. Pure function over the same rows
// FetchKeywordOpportunitiesUseCase already fetched — no separate API call.
export function detectCtrUnderperformers(
  projectId: string,
  rows: readonly PageQueryPerformance[]
): CtrUnderperformer[] {
  const eligibleRows = rows.filter((row) => row.impressions >= MIN_IMPRESSIONS);

  const bucketStats = new Map<number, { totalCtr: number; count: number }>();
  for (const row of eligibleRows) {
    const bucket = positionBucket(row.position);
    const existing = bucketStats.get(bucket) ?? { totalCtr: 0, count: 0 };
    bucketStats.set(bucket, { totalCtr: existing.totalCtr + row.ctr, count: existing.count + 1 });
  }

  const issues: CtrUnderperformer[] = [];
  for (const row of eligibleRows) {
    if (row.position > TOP_POSITION_THRESHOLD) continue;

    const stats = bucketStats.get(positionBucket(row.position));
    // Need at least one other query at this rank to compare against —
    // with only this row in the bucket, the "average" is just itself.
    if (!stats || stats.count < 2) continue;

    const expectedCtr = stats.totalCtr / stats.count;
    if (expectedCtr <= 0) continue;
    if (row.ctr >= expectedCtr * UNDERPERFORMANCE_RATIO) continue;

    issues.push(
      CtrUnderperformer.create(projectId, row.page, row.query, row.position, row.ctr, expectedCtr, row.clicks, row.impressions)
    );
  }

  return issues;
}
