import { describe, expect, it } from "vitest";
import { DomainEventDispatcher } from "@/shared/domain-event-dispatcher";
import { DomainEvent } from "@/shared/domain-event";
import type { EventHandlerFailureStore, RecordEventHandlerFailureInput } from "@/shared/event-handler-failure-store";

class FooEvent extends DomainEvent {
  constructor(readonly value: string) {
    super();
  }
}

class BarEvent extends DomainEvent {}

class ProjectScopedEvent extends DomainEvent {
  constructor(readonly projectId: string) {
    super();
  }
}

class FakeEventHandlerFailureStore implements EventHandlerFailureStore {
  readonly recorded: RecordEventHandlerFailureInput[] = [];
  private readonly failRecordWith: Error | null;

  constructor(failRecordWith: Error | null = null) {
    this.failRecordWith = failRecordWith;
  }

  async record(input: RecordEventHandlerFailureInput): Promise<void> {
    if (this.failRecordWith) throw this.failRecordWith;
    this.recorded.push(input);
  }

  async findRecentByProjectId() {
    return [];
  }
}

describe("DomainEventDispatcher", () => {
  it("calls the handler registered for an event's class", async () => {
    const dispatcher = new DomainEventDispatcher();
    const received: string[] = [];
    dispatcher.on(FooEvent, async (event) => {
      received.push(event.value);
    });

    await dispatcher.dispatch([new FooEvent("a")]);

    expect(received).toEqual(["a"]);
  });

  it("does not call handlers registered for a different event class", async () => {
    const dispatcher = new DomainEventDispatcher();
    let called = false;
    dispatcher.on(BarEvent, async () => {
      called = true;
    });

    await dispatcher.dispatch([new FooEvent("a")]);

    expect(called).toBe(false);
  });

  it("calls multiple handlers registered for the same event class, in order", async () => {
    const dispatcher = new DomainEventDispatcher();
    const order: number[] = [];
    dispatcher.on(FooEvent, async () => {
      order.push(1);
    });
    dispatcher.on(FooEvent, async () => {
      order.push(2);
    });

    await dispatcher.dispatch([new FooEvent("a")]);

    expect(order).toEqual([1, 2]);
  });

  it("is a no-op for an event with no registered handlers", async () => {
    const dispatcher = new DomainEventDispatcher();
    await expect(dispatcher.dispatch([new FooEvent("a")])).resolves.toBeUndefined();
  });

  it("processes a batch of mixed event types, routing each to its own handlers", async () => {
    const dispatcher = new DomainEventDispatcher();
    const received: string[] = [];
    dispatcher.on(FooEvent, async (event) => {
      received.push(`foo:${event.value}`);
    });
    dispatcher.on(BarEvent, async () => {
      received.push("bar");
    });

    await dispatcher.dispatch([new FooEvent("x"), new BarEvent(), new FooEvent("y")]);

    expect(received).toEqual(["foo:x", "bar", "foo:y"]);
  });

  it("isolates a throwing handler so later handlers for the same event still run", async () => {
    const dispatcher = new DomainEventDispatcher();
    let secondCalled = false;
    dispatcher.on(FooEvent, async () => {
      throw new Error("boom");
    });
    dispatcher.on(FooEvent, async () => {
      secondCalled = true;
    });

    await expect(dispatcher.dispatch([new FooEvent("a")])).resolves.toBeUndefined();
    expect(secondCalled).toBe(true);
  });

  it("logs a handler failure when a logger is provided", async () => {
    const errors: Array<{ message: string; context?: Record<string, unknown> }> = [];
    const logger = {
      debug: () => {},
      info: () => {},
      warn: () => {},
      error: (message: string, context?: Record<string, unknown>) => {
        errors.push({ message, context });
      },
    };
    const dispatcher = new DomainEventDispatcher(logger);
    dispatcher.on(FooEvent, async () => {
      throw new Error("boom");
    });

    await dispatcher.dispatch([new FooEvent("a")]);

    expect(errors).toHaveLength(1);
    expect(errors[0]?.context?.event).toBe("FooEvent");
    expect(errors[0]?.context?.message).toBe("boom");
  });

  it("records a handler failure to the failure store when the event carries a projectId", async () => {
    const failureStore = new FakeEventHandlerFailureStore();
    const dispatcher = new DomainEventDispatcher(undefined, failureStore);
    dispatcher.on(ProjectScopedEvent, async () => {
      throw new Error("boom");
    });

    await dispatcher.dispatch([new ProjectScopedEvent("project-1")]);

    expect(failureStore.recorded).toEqual([{ projectId: "project-1", eventType: "ProjectScopedEvent", message: "boom" }]);
  });

  it("does not record a failure for an event with no projectId field", async () => {
    const failureStore = new FakeEventHandlerFailureStore();
    const dispatcher = new DomainEventDispatcher(undefined, failureStore);
    dispatcher.on(FooEvent, async () => {
      throw new Error("boom");
    });

    await dispatcher.dispatch([new FooEvent("a")]);

    expect(failureStore.recorded).toEqual([]);
  });

  it("does not record anything when the handler succeeds", async () => {
    const failureStore = new FakeEventHandlerFailureStore();
    const dispatcher = new DomainEventDispatcher(undefined, failureStore);
    dispatcher.on(ProjectScopedEvent, async () => {});

    await dispatcher.dispatch([new ProjectScopedEvent("project-1")]);

    expect(failureStore.recorded).toEqual([]);
  });

  it("logs a second error rather than throwing when the failure store itself fails", async () => {
    const errors: Array<{ message: string; context?: Record<string, unknown> }> = [];
    const logger = {
      debug: () => {},
      info: () => {},
      warn: () => {},
      error: (message: string, context?: Record<string, unknown>) => {
        errors.push({ message, context });
      },
    };
    const failureStore = new FakeEventHandlerFailureStore(new Error("db down"));
    const dispatcher = new DomainEventDispatcher(logger, failureStore);
    dispatcher.on(ProjectScopedEvent, async () => {
      throw new Error("boom");
    });

    await expect(dispatcher.dispatch([new ProjectScopedEvent("project-1")])).resolves.toBeUndefined();

    expect(errors).toHaveLength(2);
    expect(errors[0]?.context?.message).toBe("boom");
    expect(errors[1]?.message).toBe("Failed to persist domain event handler failure");
    expect(errors[1]?.context?.message).toBe("db down");
  });
});
