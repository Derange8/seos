import { DomainEvent } from "@/shared/domain-event";

export class AuditRunCompleted extends DomainEvent {
  constructor(
    readonly auditRunId: string,
    readonly projectId: string
  ) {
    super();
  }
}
