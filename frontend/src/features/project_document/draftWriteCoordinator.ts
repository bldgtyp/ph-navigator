export type DraftWriteStatus = Readonly<{ queued: number; inFlight: boolean }>;

export type TransportTask<T = unknown> = {
  label: string;
  run(): Promise<T>;
};

export type WriteHandle<T = unknown> = {
  accepted: Promise<void>;
  settled: Promise<T>;
};

export class WriteQueueDrainedError extends Error {
  constructor(readonly cause: unknown) {
    super("An earlier draft write failed; this queued write was not sent.");
    this.name = "WriteQueueDrainedError";
  }
}

export class WriteQueueCancelledError extends Error {
  constructor() {
    super("The queued draft write was cancelled.");
    this.name = "WriteQueueCancelledError";
  }
}

type Deferred<T = void> = {
  promise: Promise<T>;
  resolve(value: T): void;
  reject(reason: unknown): void;
};

type QueueEntry = { task: TransportTask; deferred: Deferred<unknown> };
type IdleWaiter = { deferred: Deferred; rejectOnFailure: boolean };

export class DraftWriteCoordinator {
  readonly key: string;
  private queue: QueueEntry[] = [];
  private inFlight = false;
  private listeners = new Set<() => void>();
  private idleWaiters: IdleWaiter[] = [];
  private snapshot: DraftWriteStatus = { queued: 0, inFlight: false };
  private drainFailure: unknown = null;

  constructor(key: string) {
    this.key = key;
  }

  schedule<T>(task: TransportTask<T>): WriteHandle<T> {
    const deferred = createDeferred<unknown>();
    // The coordinator owns a rejection observer even when a caller intentionally
    // ignores a fire-and-forget handle. Callers still receive the original promise.
    void deferred.promise.catch(() => undefined);
    this.drainFailure = null;
    this.queue.push({ task, deferred });
    this.publish();
    this.pump();
    const accepted = deferred.promise.then(() => undefined);
    void accepted.catch(() => undefined);
    return { accepted, settled: deferred.promise as Promise<T> };
  }

  flush(): Promise<void> {
    if (!this.inFlight && this.queue.length === 0) {
      return this.drainFailure === null ? Promise.resolve() : Promise.reject(this.drainFailure);
    }
    const deferred = createDeferred();
    this.idleWaiters.push({ deferred, rejectOnFailure: true });
    return deferred.promise;
  }

  whenIdle(): Promise<void> {
    if (!this.inFlight && this.queue.length === 0) return Promise.resolve();
    const deferred = createDeferred();
    this.idleWaiters.push({ deferred, rejectOnFailure: false });
    return deferred.promise;
  }

  cancel(): void {
    const queued = this.queue.splice(0);
    for (const entry of queued) entry.deferred.reject(new WriteQueueCancelledError());
    this.publish();
    this.settleIdleWaitersIfIdle();
  }

  status = (): DraftWriteStatus => this.snapshot;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
      queueMicrotask(() => disposeCoordinatorIfUnused(this));
    };
  };

  isDisposable(): boolean {
    return !this.inFlight && this.queue.length === 0 && this.listeners.size === 0;
  }

  private pump(): void {
    if (this.inFlight) return;
    const entry = this.queue.shift();
    if (!entry) {
      this.settleIdleWaitersIfIdle();
      disposeCoordinatorIfUnused(this);
      return;
    }

    this.inFlight = true;
    this.publish();
    void entry.task.run().then(
      (result) => {
        entry.deferred.resolve(result);
        this.finishTask();
      },
      (error: unknown) => {
        this.drainFailure = error;
        entry.deferred.reject(error);
        const queued = this.queue.splice(0);
        for (const waiting of queued) waiting.deferred.reject(new WriteQueueDrainedError(error));
        this.finishTask();
      },
    );
  }

  private finishTask(): void {
    this.inFlight = false;
    this.publish();
    if (this.queue.length > 0) this.pump();
    else {
      this.settleIdleWaitersIfIdle();
      disposeCoordinatorIfUnused(this);
    }
  }

  private publish(): void {
    const next = { queued: this.queue.length, inFlight: this.inFlight };
    if (next.queued === this.snapshot.queued && next.inFlight === this.snapshot.inFlight) return;
    this.snapshot = next;
    for (const listener of this.listeners) listener();
  }

  private settleIdleWaitersIfIdle(): void {
    if (this.inFlight || this.queue.length > 0 || this.idleWaiters.length === 0) return;
    const waiters = this.idleWaiters.splice(0);
    for (const waiter of waiters) {
      if (waiter.rejectOnFailure && this.drainFailure !== null)
        waiter.deferred.reject(this.drainFailure);
      else waiter.deferred.resolve();
    }
  }
}

const coordinators = new Map<string, DraftWriteCoordinator>();

export function draftWriteCoordinatorKey(projectId: string, versionId: string): string {
  return `${projectId}:${versionId}`;
}

export function getDraftWriteCoordinator(
  projectId: string,
  versionId: string,
): DraftWriteCoordinator {
  const key = draftWriteCoordinatorKey(projectId, versionId);
  const existing = coordinators.get(key);
  if (existing) return existing;
  const coordinator = new DraftWriteCoordinator(key);
  coordinators.set(key, coordinator);
  return coordinator;
}

function disposeCoordinatorIfUnused(coordinator: DraftWriteCoordinator): void {
  if (coordinator.isDisposable() && coordinators.get(coordinator.key) === coordinator) {
    coordinators.delete(coordinator.key);
  }
}

function createDeferred<T = void>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

export function resetDraftWriteCoordinatorsForTests(): void {
  coordinators.clear();
}
