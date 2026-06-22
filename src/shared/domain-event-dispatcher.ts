import type { DomainEvent } from "@/shared/domain-event";
import type { Logger } from "@/shared/logger";
import type { EventHandlerFailureStore } from "@/shared/event-handler-failure-store";

type DomainEventConstructor<T extends DomainEvent = DomainEvent> = new (...args: never[]) => T;
type DomainEventHandler<T extends DomainEvent> = (event: T) => Promise<void>;

// Minimal in-process pub/sub for domain events pulled off an aggregate after
// it's saved (see AggregateRoot.pullDomainEvents()) — e.g. CrawlJobCompleted
// triggering an audit run. Dispatch by class identity rather than a string
// discriminator: events are plain DomainEvent subclasses, no extra
// boilerplate needed on each one.
export class DomainEventDispatcher {
  private readonly handlers = new Map<DomainEventConstructor, DomainEventHandler<DomainEvent>[]>();

  constructor(
    private readonly logger?: Logger,
    private readonly failureStore?: EventHandlerFailureStore
  ) {}

  on<T extends DomainEvent>(eventType: DomainEventConstructor<T>, handler: DomainEventHandler<T>): void {
    const existing = this.handlers.get(eventType as DomainEventConstructor) ?? [];
    existing.push(handler as DomainEventHandler<DomainEvent>);
    this.handlers.set(eventType as DomainEventConstructor, existing);
  }

  async dispatch(events: readonly DomainEvent[]): Promise<void> {
    for (const event of events) {
      const matched = this.handlers.get(event.constructor as DomainEventConstructor) ?? [];
      for (const handler of matched) {
        // Isolated per handler — e.g. CrawlJobCompleted fans out to both an
        // audit run and a sitemap regeneration; one failing (a transient DB
        // hiccup, say) shouldn't take the other down with it.
        try {
          await handler(event);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          this.logger?.error("Domain event handler failed", { event: event.constructor.name, message });
          await this.recordFailure(event, message);
        }
      }
    }
  }

  private async recordFailure(event: DomainEvent, message: string): Promise<void> {
    if (!this.failureStore) return;
    // Not every DomainEvent is guaranteed to carry a projectId, but every
    // one dispatched in this codebase today does — falls back to logging
    // only (already done above) rather than guessing at a project to
    // attribute the failure to.
    const projectId = (event as unknown as { projectId?: unknown }).projectId;
    if (typeof projectId !== "string") return;

    try {
      await this.failureStore.record({ projectId, eventType: event.constructor.name, message });
    } catch (error) {
      // Recording the failure must never itself become a second silent
      // failure — the original error is already logged above; just
      // surface this secondary one too rather than swallowing it.
      this.logger?.error("Failed to persist domain event handler failure", {
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
