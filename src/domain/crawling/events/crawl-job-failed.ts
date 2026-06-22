import { DomainEvent } from "@/shared/domain-event";

export class CrawlJobFailed extends DomainEvent {
  constructor(
    readonly crawlJobId: string,
    readonly projectId: string,
    readonly reason: string
  ) {
    super();
  }
}
