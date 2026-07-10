import { beforeEach, describe, expect, it, vi } from "vitest";
import { createControllableTransport } from "../../shared/ui/data-table/feature/writeTestHarness";
import {
  DraftWriteCoordinator,
  WriteQueueCancelledError,
  WriteQueueDrainedError,
  getDraftWriteCoordinator,
  resetDraftWriteCoordinatorsForTests,
} from "./draftWriteCoordinator";

beforeEach(resetDraftWriteCoordinatorsForTests);

describe("DraftWriteCoordinator", () => {
  it("dispatches immediately and serializes tasks in FIFO order", async () => {
    const controlled = createControllableTransport<string, void>();
    const coordinator = new DraftWriteCoordinator("p:v");
    const first = coordinator.schedule({
      label: "first",
      run: () => controlled.transport("first"),
    });
    const second = coordinator.schedule({
      label: "second",
      run: () => controlled.transport("second"),
    });

    expect(controlled.requests.map(({ request }) => request)).toEqual(["first"]);
    expect(coordinator.status()).toEqual({ queued: 1, inFlight: true });
    controlled.requests[0]!.response.resolve();
    await first.settled;
    expect(controlled.requests.map(({ request }) => request)).toEqual(["first", "second"]);
    controlled.requests[1]!.response.resolve();
    await second.settled;
    expect(coordinator.status()).toEqual({ queued: 0, inFlight: false });
  });

  it("drains queued tasks after a failure and remains reusable", async () => {
    const controlled = createControllableTransport<string, void>();
    const coordinator = new DraftWriteCoordinator("p:v");
    const first = coordinator.schedule({
      label: "first",
      run: () => controlled.transport("first"),
    });
    const second = coordinator.schedule({
      label: "second",
      run: () => controlled.transport("second"),
    });
    const flush = coordinator.flush();
    const error = new Error("stale draft");
    controlled.requests[0]!.response.reject(error);

    await expect(first.settled).rejects.toBe(error);
    await expect(second.settled).rejects.toBeInstanceOf(WriteQueueDrainedError);
    await expect(flush).rejects.toBe(error);
    const recovery = coordinator.schedule({ label: "recovery", run: () => Promise.resolve() });
    await expect(recovery.settled).resolves.toBeUndefined();
  });

  it("cancels queued work but lets the in-flight request finish", async () => {
    const controlled = createControllableTransport<string, void>();
    const coordinator = new DraftWriteCoordinator("p:v");
    const first = coordinator.schedule({
      label: "first",
      run: () => controlled.transport("first"),
    });
    const second = coordinator.schedule({
      label: "second",
      run: () => controlled.transport("second"),
    });

    coordinator.cancel();
    await expect(second.settled).rejects.toBeInstanceOf(WriteQueueCancelledError);
    expect(controlled.requests).toHaveLength(1);
    controlled.requests[0]!.response.resolve();
    await first.settled;
    await expect(coordinator.whenIdle()).resolves.toBeUndefined();
  });

  it("flush waits only for writes accepted before its boundary", async () => {
    const controlled = createControllableTransport<string, void>();
    const coordinator = new DraftWriteCoordinator("p:v");
    const first = coordinator.schedule({
      label: "first",
      run: () => controlled.transport("first"),
    });
    const flush = coordinator.flush();
    const second = coordinator.schedule({
      label: "second",
      run: () => controlled.transport("second"),
    });

    controlled.requests[0]!.response.resolve();
    await first.settled;
    await expect(flush).resolves.toBeUndefined();
    expect(coordinator.status()).toEqual({ queued: 0, inFlight: true });
    controlled.requests[1]!.response.resolve();
    await second.settled;
  });

  it("publishes status changes and reuses one registry lane per draft", async () => {
    const coordinator = getDraftWriteCoordinator("p", "v");
    expect(getDraftWriteCoordinator("p", "v")).toBe(coordinator);
    expect(getDraftWriteCoordinator("p", "other")).not.toBe(coordinator);
    const listener = vi.fn();
    const unsubscribe = coordinator.subscribe(listener);
    const handle = coordinator.schedule({ label: "write", run: () => Promise.resolve() });
    await handle.settled;
    expect(listener).toHaveBeenCalled();
    unsubscribe();
  });

  it("does not split a registry lane during a transient resubscribe", async () => {
    const coordinator = getDraftWriteCoordinator("p", "v");
    const unsubscribe = coordinator.subscribe(() => undefined);
    unsubscribe();
    const resubscribe = coordinator.subscribe(() => undefined);

    await Promise.resolve();
    expect(getDraftWriteCoordinator("p", "v")).toBe(coordinator);
    resubscribe();
  });
});
