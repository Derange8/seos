// better-sqlite3 is a single synchronous connection — it has no concept of
// concurrent transactions. When multiple async callers each open a Prisma
// $transaction() against it at once (e.g. several crawl pages saving in
// parallel under CRAWL_WORKER_CONCURRENCY), their BEGIN/COMMIT pairs can
// interleave on that one connection: one transaction's writes end up
// silently absorbed into another's, and whichever commits last "wins" —
// no error, just data that was written but never actually persisted. This
// queues callers so only one transaction touches the connection at a time.
export class AsyncMutex {
  private queue: Promise<void> = Promise.resolve();

  async runExclusive<T>(fn: () => Promise<T>): Promise<T> {
    const previous = this.queue;
    let release!: () => void;
    this.queue = new Promise<void>((resolve) => {
      release = resolve;
    });

    await previous;
    try {
      return await fn();
    } finally {
      release();
    }
  }
}

// One shared lock for the whole process — every Prisma $transaction() call
// against the single better-sqlite3 connection should go through it,
// regardless of which repository initiates it.
export const sqliteWriteLock = new AsyncMutex();
