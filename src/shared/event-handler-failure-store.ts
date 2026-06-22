export interface EventHandlerFailure {
  id: string;
  projectId: string;
  eventType: string;
  message: string;
  occurredAt: Date;
}

export interface RecordEventHandlerFailureInput {
  projectId: string;
  eventType: string;
  message: string;
}

// Sibling to Logger — a dependency of DomainEventDispatcher (shared
// kernel), not owned by any single bounded context. Logger handles the
// "developer can see this in server logs" side; this handles the "the
// product can show this to the user" side (see project-dashboard.tsx's
// event-failures fetch).
export interface EventHandlerFailureStore {
  record(input: RecordEventHandlerFailureInput): Promise<void>;
  findRecentByProjectId(projectId: string, limit?: number): Promise<EventHandlerFailure[]>;
}
