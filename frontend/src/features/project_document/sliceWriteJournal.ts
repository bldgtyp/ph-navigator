import type { DraftWriteCoordinator, TransportTask, WriteHandle } from "./draftWriteCoordinator";

export type JournalWrite<TSlice, TPayload> = {
  label: string;
  refreshBase?: boolean;
  batchable?: boolean;
  metadata?: unknown;
  buildPayload(slice: TSlice): TPayload;
  buildBatchPayload?(slice: TSlice, metadata: readonly unknown[]): TPayload;
  validate(payload: TPayload): string | null;
};

type JournalEntry<TSlice, TPayload> = JournalWrite<TSlice, TPayload> & { id: number };

export class SliceWriteJournal<TSlice, TPayload> {
  private lastAcked: TSlice;
  private currentRendered: TSlice;
  private outstanding: JournalEntry<TSlice, TPayload>[] = [];
  private nextId = 1;

  constructor(
    initial: TSlice,
    private readonly coordinator: DraftWriteCoordinator,
    private readonly applyPayload: (slice: TSlice, payload: TPayload) => TSlice,
    private readonly transport: (slice: TSlice, payload: TPayload) => Promise<TSlice>,
    private readonly render: (slice: TSlice) => void,
    private readonly onFailure: (error: unknown, rejectedCount: number) => void,
    private readonly prepareBase: (
      slice: TSlice,
      forceRefresh: boolean,
    ) => Promise<TSlice> = async (slice) => slice,
    private readonly coalesceKey: string | null = null,
  ) {
    this.lastAcked = initial;
    this.currentRendered = initial;
  }

  syncAcknowledgedSlice(slice: TSlice): void {
    if (this.outstanding.length === 0) {
      this.lastAcked = slice;
      this.currentRendered = slice;
    }
  }

  accept(write: JournalWrite<TSlice, TPayload>): WriteHandle<TSlice> {
    const optimisticPayload = write.buildPayload(this.currentRendered);
    const validationMessage = write.validate(optimisticPayload);
    if (validationMessage) {
      const rejected = Promise.reject<TSlice>(new Error(validationMessage));
      void rejected.catch(() => undefined);
      return { accepted: rejected.then(() => undefined), settled: rejected };
    }

    const entry = { ...write, id: this.nextId++ };
    this.outstanding.push(entry);
    this.currentRendered = this.applyPayload(this.currentRendered, optimisticPayload);
    this.render(this.currentRendered);
    const transportHandle = this.coordinator.schedule(this.transportTask(entry));
    void transportHandle.settled.catch((error: unknown) => this.fail(error));
    return { accepted: Promise.resolve(), settled: transportHandle.settled };
  }

  reset(slice: TSlice): void {
    this.lastAcked = slice;
    this.currentRendered = slice;
    this.outstanding = [];
    this.render(slice);
  }

  status(): { outstanding: number } {
    return { outstanding: this.outstanding.length };
  }

  private transportTask(entry: JournalEntry<TSlice, TPayload>): TransportTask<TSlice> {
    const task: TransportTask<TSlice> = {
      label: entry.label,
      run: () => this.runEntries([entry]),
    };
    if (entry.batchable && this.coalesceKey) {
      task.batch = {
        key: this.coalesceKey,
        value: entry,
        run: (values) => this.runEntries(values as JournalEntry<TSlice, TPayload>[]),
      };
    }
    return task;
  }

  private async runEntries(entries: JournalEntry<TSlice, TPayload>[]): Promise<TSlice> {
    const preparedBase = await this.prepareBase(
      this.lastAcked,
      entries.some((entry) => entry.refreshBase === true),
    );
    if (preparedBase !== this.lastAcked) {
      this.lastAcked = preparedBase;
      this.rebaseRendered();
    }
    let payload: TPayload;
    const batchBuilder = entries.length > 1 ? entries[0]?.buildBatchPayload : undefined;
    if (batchBuilder) {
      payload = batchBuilder(
        this.lastAcked,
        entries.map((entry) => entry.metadata),
      );
      const validationMessage = entries[0]!.validate(payload);
      if (validationMessage) throw new Error(validationMessage);
    } else {
      let transportProjection = this.lastAcked;
      let latestPayload: TPayload | null = null;
      for (const entry of entries) {
        latestPayload = entry.buildPayload(transportProjection);
        const validationMessage = entry.validate(latestPayload);
        if (validationMessage) throw new Error(validationMessage);
        transportProjection = this.applyPayload(transportProjection, latestPayload);
      }
      if (latestPayload === null) throw new Error("Cannot dispatch an empty journal batch.");
      payload = latestPayload;
    }
    const acknowledged = await this.transport(this.lastAcked, payload);
    this.lastAcked = acknowledged;
    const settledIds = new Set(entries.map((entry) => entry.id));
    this.outstanding = this.outstanding.filter((entry) => !settledIds.has(entry.id));
    this.rebaseRendered();
    return acknowledged;
  }

  private rebaseRendered(): void {
    this.currentRendered = this.outstanding.reduce(
      (current, entry) => this.applyPayload(current, entry.buildPayload(current)),
      this.lastAcked,
    );
    this.render(this.currentRendered);
  }

  private fail(error: unknown): void {
    const rejectedCount = this.outstanding.length;
    if (rejectedCount === 0) return;
    this.outstanding = [];
    this.currentRendered = this.lastAcked;
    this.render(this.currentRendered);
    this.onFailure(error, rejectedCount);
  }
}

export function mergeSlicePayload<TSlice extends object>(
  slice: TSlice,
  payload: Partial<TSlice>,
): TSlice {
  return { ...slice, ...payload };
}
