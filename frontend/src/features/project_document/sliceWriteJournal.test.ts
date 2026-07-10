import { describe, expect, it, vi } from "vitest";
import { createDeferred } from "../../test-utils/async";
import { DraftWriteCoordinator } from "./draftWriteCoordinator";
import { mergeSlicePayload, SliceWriteJournal } from "./sliceWriteJournal";

type Slice = { draft_etag: string; rows: string[] };
type Payload = { rows: string[] };

function append(value: string) {
  return {
    label: `rows:${value}`,
    buildPayload: (slice: Slice): Payload => ({ rows: [...slice.rows, value] }),
    validate: () => null,
  };
}

describe("SliceWriteJournal", () => {
  it("renders every accepted op but sends only the dispatched op", async () => {
    const first = createDeferred<Slice>();
    const requests: Slice[] = [];
    const renders: Slice[] = [];
    const transport = vi.fn(async (slice: Slice, payload: Payload) => {
      requests.push(mergeSlicePayload(slice, payload));
      if (requests.length === 1) return first.promise;
      return { draft_etag: `etag-${requests.length}`, rows: payload.rows };
    });
    const journal = new SliceWriteJournal(
      { draft_etag: "etag-0", rows: [] },
      new DraftWriteCoordinator("test"),
      mergeSlicePayload,
      transport,
      (slice) => renders.push(slice),
      vi.fn(),
    );

    const a = journal.accept(append("A"));
    const b = journal.accept(append("B"));
    const c = journal.accept(append("C"));
    await Promise.all([a.accepted, b.accepted, c.accepted]);

    expect(renders.at(-1)?.rows).toEqual(["A", "B", "C"]);
    expect(requests).toEqual([{ draft_etag: "etag-0", rows: ["A"] }]);

    first.resolve({ draft_etag: "etag-1", rows: ["A"] });
    await Promise.all([a.settled, b.settled, c.settled]);
    expect(requests.map((request) => request.rows)).toEqual([["A"], ["A", "B"], ["A", "B", "C"]]);
    expect(renders.at(-1)).toEqual({ draft_etag: "etag-3", rows: ["A", "B", "C"] });
  });

  it("rebases queued operations over a normalized acknowledgement", async () => {
    const first = createDeferred<Slice>();
    const renders: Slice[] = [];
    const journal = new SliceWriteJournal(
      { draft_etag: "etag-0", rows: [] },
      new DraftWriteCoordinator("test"),
      mergeSlicePayload,
      vi
        .fn()
        .mockImplementationOnce(() => first.promise)
        .mockImplementation(async (_slice, payload) => ({
          draft_etag: "etag-2",
          rows: payload.rows,
        })),
      (slice) => renders.push(slice),
      vi.fn(),
    );
    const a = journal.accept(append("raw"));
    const b = journal.accept(append("next"));
    first.resolve({ draft_etag: "etag-1", rows: ["NORMALIZED"] });
    await Promise.all([a.settled, b.settled]);
    expect(renders.at(-1)?.rows).toEqual(["NORMALIZED", "next"]);
  });

  it("rolls back the whole outstanding journal once on failure and remains reusable", async () => {
    const failure = new Error("nope");
    const onFailure = vi.fn();
    const renders: Slice[] = [];
    const transport = vi
      .fn()
      .mockRejectedValueOnce(failure)
      .mockImplementation(async (_slice, payload) => ({
        draft_etag: "etag-ok",
        rows: payload.rows,
      }));
    const journal = new SliceWriteJournal(
      { draft_etag: "etag-0", rows: [] },
      new DraftWriteCoordinator("test"),
      mergeSlicePayload,
      transport,
      (slice) => renders.push(slice),
      onFailure,
    );
    const a = journal.accept(append("A"));
    const b = journal.accept(append("B"));
    await expect(a.settled).rejects.toBe(failure);
    await expect(b.settled).rejects.toThrow("earlier draft write failed");
    expect(onFailure).toHaveBeenCalledOnce();
    expect(onFailure).toHaveBeenCalledWith(failure, 2);
    expect(renders.at(-1)).toEqual({ draft_etag: "etag-0", rows: [] });

    const recovered = journal.accept(append("C"));
    await expect(recovered.settled).resolves.toEqual({ draft_etag: "etag-ok", rows: ["C"] });
  });
});
