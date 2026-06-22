export abstract class DomainEvent {
  readonly occurredAt: Date = new Date();
}
