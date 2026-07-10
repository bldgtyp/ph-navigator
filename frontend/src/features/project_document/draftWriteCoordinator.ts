export type DraftWriteStatus = Readonly<{ queued: number; inFlight: boolean }>;

export type TransportTask<T = unknown> = {
  label: string;
  run(): Promise<T>;
  batch?: {
    key: string;
    value: unknown;
    run(values: readonly unknown[]): Promise<T>;
  };
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

type QueueHandle = { sequence: number; deferred: Deferred<unknown> };
type QueueEntry = { batchEpoch: number; tasks: TransportTask[]; handles: QueueHandle[] };
type IdleWaiter = { deferred: Deferred; targetSequence: number | null };

export class DraftWriteCoordinator {
  readonly key: string;
  private queue: QueueEntry[] = [];
  private inFlight = false;
  private listeners = new Set<() => void>();
  private idleWaiters: IdleWaiter[] = [];
  private snapshot: DraftWriteStatus = { queued: 0, inFlight: false };
  private drainFailure: unknown = null;
  private scheduledSequence = 0;
  private completedSequence = 0;
  private batchEpoch = 0;
  private queuedHandles = 0;

  constructor(key: string) {
    this.key = key;
  }

  schedule<T>(task: TransportTask<T>): WriteHandle<T> {
    const deferred = createDeferred<unknown>();
    // The coordinator owns a rejection observer even when a caller intentionally
    // ignores a fire-and-forget handle. Callers still receive the original promise.
    void deferred.promise.catch(() => undefined);
    this.drainFailure = null;
    const handle = { sequence: ++this.scheduledSequence, deferred };
    const lastQueued = this.queue.at(-1);
    if (
      task.batch &&
      lastQueued?.batchEpoch === this.batchEpoch &&
      lastQueued?.tasks[0]?.batch?.key === task.batch.key
    ) {
      lastQueued.tasks.push(task);
      lastQueued.handles.push(handle);
    } else {
      this.queue.push({ batchEpoch: this.batchEpoch, tasks: [task], handles: [handle] });
    }
    this.queuedHandles += 1;
    this.publish();
    this.pump();
    const accepted = deferred.promise.then(() => undefined);
    void accepted.catch(() => undefined);
    return { accepted, settled: deferred.promise as Promise<T> };
  }

  flush(): Promise<void> {
    const targetSequence = this.scheduledSequence;
    this.batchEpoch += 1;
    if (this.completedSequence >= targetSequence) {
      return this.drainFailure === null ? Promise.resolve() : Promise.reject(this.drainFailure);
    }
    const deferred = createDeferred();
    this.idleWaiters.push({ deferred, targetSequence });
    return deferred.promise;
  }

  whenIdle(): Promise<void> {
    if (!this.inFlight && this.queue.length === 0) return Promise.resolve();
    const deferred = createDeferred();
    this.idleWaiters.push({ deferred, targetSequence: null });
    return deferred.promise;
  }

  cancel(): void {
    const queued = this.queue.splice(0);
    this.queuedHandles = 0;
    for (const entry of queued) {
      for (const handle of entry.handles) handle.deferred.reject(new WriteQueueCancelledError());
    }
    const lastCancelled = queued.at(-1)?.handles.at(-1);
    if (lastCancelled) this.completedSequence = lastCancelled.sequence;
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

    this.queuedHandles -= entry.handles.length;
    this.inFlight = true;
    this.publish();
    const firstTask = entry.tasks[0]!;
    const execution =
      entry.tasks.length > 1 && firstTask.batch
        ? firstTask.batch.run(entry.tasks.map((task) => task.batch!.value))
        : firstTask.run();
    void execution.then(
      (result) => {
        this.completedSequence = entry.handles.at(-1)!.sequence;
        for (const handle of entry.handles) handle.deferred.resolve(result);
        this.settleIdleWaitersIfIdle();
        this.finishTask();
      },
      (error: unknown) => {
        this.drainFailure = error;
        for (const handle of entry.handles) handle.deferred.reject(error);
        const queued = this.queue.splice(0);
        this.queuedHandles = 0;
        for (const waiting of queued) {
          for (const handle of waiting.handles) {
            handle.deferred.reject(new WriteQueueDrainedError(error));
          }
        }
        this.completedSequence =
          queued.at(-1)?.handles.at(-1)?.sequence ?? entry.handles.at(-1)!.sequence;
        this.settleIdleWaitersIfIdle();
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
    const next = {
      queued: this.queuedHandles,
      inFlight: this.inFlight,
    };
    if (next.queued === this.snapshot.queued && next.inFlight === this.snapshot.inFlight) return;
    this.snapshot = next;
    for (const listener of this.listeners) listener();
  }

  private settleIdleWaitersIfIdle(): void {
    if (this.idleWaiters.length === 0) return;
    const ready: IdleWaiter[] = [];
    const pending: IdleWaiter[] = [];
    for (const waiter of this.idleWaiters) {
      const isReady =
        waiter.targetSequence === null
          ? !this.inFlight && this.queue.length === 0
          : this.completedSequence >= waiter.targetSequence;
      (isReady ? ready : pending).push(waiter);
    }
    this.idleWaiters = pending;
    for (const waiter of ready) {
      if (waiter.targetSequence !== null && this.drainFailure !== null)
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
