import { DomainEvent } from "@/shared/domain-event";

export class CrawlJobCompleted extends DomainEvent {
  constructor(
    readonly crawlJobId: string,
    readonly projectId: string
  ) {
    super();
  }
}
