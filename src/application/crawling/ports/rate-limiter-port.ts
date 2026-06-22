// Politeness throttle: resolves once it's this caller's turn to fetch
// `origin` again. The first call for a never-seen origin resolves
// immediately; later calls wait out whatever's left of the minimum
// interval since the last call for that same origin. minIntervalMs lets a
// site's own robots.txt Crawl-delay override the default (see
// ProcessPageTaskUseCase).
export interface RateLimiterPort {
  waitForTurn(origin: string, minIntervalMs: number): Promise<void>;
}
