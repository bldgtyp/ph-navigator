import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { ApiRequestError } from "../../../../../shared/api/client";
import * as api from "../api";
import { ImportDialog } from "../ImportDialog";
import type { CommitResponse, PreviewResponse } from "../types";

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

function OpenDialog({ onCommitted }: { onCommitted?: () => void } = {}) {
  const [open, setOpen] = useState(true);
  return open ? <ImportDialog onClose={() => setOpen(false)} onCommitted={onCommitted} /> : null;
}

function previewResponse(overrides: Partial<PreviewResponse> = {}): PreviewResponse {
  return {
    token: "tok-1",
    schema_version: 1,
    counts: { new: 2, matched: 0, errored: 0, warnings: 0 },
    warnings: [],
    errors: [],
    rows_preview: [
      { index: 0, classification: "new", id: null, name: "Row A", category: "insulation" },
      { index: 1, classification: "new", id: null, name: "Row B", category: "insulation" },
    ],
    ...overrides,
  };
}

function commitResponse(overrides: Partial<CommitResponse> = {}): CommitResponse {
  return {
    inserted: 2,
    inserted_ids: ["rec0000000000000A", "rec0000000000000B"],
    skipped_conflict_ids: [],
    ...overrides,
  };
}

function jsonFile(name = "materials.json"): File {
  const body = JSON.stringify({
    kind: "ph-navigator.catalog.materials",
    schema_version: 1,
    rows: [{ name: "Row A", category: "insulation" }],
  });
  return new File([body], name, { type: "application/json" });
}

beforeEach(() => {
  vi.spyOn(api, "previewCatalogImportRaw").mockResolvedValue(previewResponse());
  vi.spyOn(api, "commitCatalogImport").mockResolvedValue(commitResponse());
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ImportDialog", () => {
  test("happy path: pick → preview → confirm → committed", async () => {
    const user = userEvent.setup();
    const onCommitted = vi.fn();
    render(<OpenDialog onCommitted={onCommitted} />, { wrapper });

    const fileInput = screen.getByTestId("import-dialog-file") as HTMLInputElement;
    await user.upload(fileInput, jsonFile());

    // Report stage renders the counts.
    expect(await screen.findByText("Import 2 rows")).toBeVisible();
    expect(api.previewCatalogImportRaw).toHaveBeenCalledOnce();

    await user.click(screen.getByRole("button", { name: "Import 2 rows" }));

    expect(await screen.findByText(/Imported 2 rows/)).toBeVisible();
    expect(api.commitCatalogImport).toHaveBeenCalledWith("tok-1");
    expect(onCommitted).toHaveBeenCalledWith({ inserted: 2, skippedConflict: 0 });
  });

  test("file > 8 MB is rejected client-side without a network call", async () => {
    const user = userEvent.setup();
    render(<OpenDialog />, { wrapper });

    // Construct a > 8 MB file. Use a single very large string so jsdom
    // can keep the size reading honest without allocating 8 MB of
    // actual content per chunk.
    const huge = new File([new Uint8Array(9 * 1024 * 1024)], "big.json", {
      type: "application/json",
    });

    const fileInput = screen.getByTestId("import-dialog-file") as HTMLInputElement;
    await user.upload(fileInput, huge);

    expect(await screen.findByTestId("import-dialog-error")).toHaveTextContent(/too large/i);
    expect(api.previewCatalogImportRaw).not.toHaveBeenCalled();
  });

  test("stale token on commit resets to the Pick stage", async () => {
    const user = userEvent.setup();
    render(<OpenDialog />, { wrapper });

    await user.upload(screen.getByTestId("import-dialog-file") as HTMLInputElement, jsonFile());
    await screen.findByText("Import 2 rows");

    const stale = new ApiRequestError({ status: 410, statusText: "Gone" } as Response, {
      error_code: "catalog_import_token_missing",
      message: "expired",
      request_id: "req",
      details: {},
    });
    vi.spyOn(api, "commitCatalogImport").mockRejectedValueOnce(stale);

    await user.click(screen.getByRole("button", { name: "Import 2 rows" }));

    expect(await screen.findByTestId("import-dialog-error")).toHaveTextContent(/expired/i);
    // Back to Pick stage — file input is rendered again.
    expect(screen.getByTestId("import-dialog-file")).toBeVisible();
  });

  test("cancel from the report stage does NOT call commit", async () => {
    const user = userEvent.setup();
    render(<OpenDialog />, { wrapper });

    await user.upload(screen.getByTestId("import-dialog-file") as HTMLInputElement, jsonFile());
    await screen.findByText("Import 2 rows");

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(api.commitCatalogImport).not.toHaveBeenCalled();
  });

  test("double-click on Import only triggers one commit (button disables on isPending)", async () => {
    const user = userEvent.setup();
    // Hold the commit promise open so we can prove the second click
    // hits a disabled button.
    let resolveCommit: (value: CommitResponse) => void = () => {};
    const pending = new Promise<CommitResponse>((resolve) => {
      resolveCommit = resolve;
    });
    vi.spyOn(api, "commitCatalogImport").mockReturnValue(pending);

    render(<OpenDialog />, { wrapper });
    await user.upload(screen.getByTestId("import-dialog-file") as HTMLInputElement, jsonFile());
    const importButton = await screen.findByRole("button", { name: "Import 2 rows" });
    await user.click(importButton);
    await user.click(importButton);

    expect(api.commitCatalogImport).toHaveBeenCalledTimes(1);
    resolveCommit(commitResponse());
  });

  test("closing during loading unmounts the dialog — reopening returns to Pick", async () => {
    const user = userEvent.setup();
    let resolvePreview: (value: PreviewResponse) => void = () => {};
    const pending = new Promise<PreviewResponse>((resolve) => {
      resolvePreview = resolve;
    });
    vi.spyOn(api, "previewCatalogImportRaw").mockReturnValueOnce(pending);

    function Harness() {
      const [open, setOpen] = useState(true);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            reopen
          </button>
          {open ? <ImportDialog onClose={() => setOpen(false)} /> : null}
        </>
      );
    }
    render(<Harness />, { wrapper });

    await user.upload(screen.getByTestId("import-dialog-file") as HTMLInputElement, jsonFile());

    // While loading, close. The loading stage has no footer button and the
    // header "Close" is off by default (modal contract), so dismiss via Escape,
    // which ModalDialog still handles.
    await user.keyboard("{Escape}");

    // Resolve the hanging preview AFTER close. With the conditional
    // mount the dialog is unmounted and the setState never fires.
    resolvePreview(previewResponse({ token: "tok-late" }));
    await new Promise((r) => setTimeout(r, 0));

    await user.click(screen.getByRole("button", { name: "reopen" }));
    // Pick stage — file input is back.
    expect(screen.getByTestId("import-dialog-file")).toBeVisible();
    // No stale "Import N rows" button leaked through.
    expect(screen.queryByRole("button", { name: /Import \d+ rows?/ })).toBeNull();
  });

  test("mapped error_code surfaces curated copy verbatim (not the server message)", async () => {
    const user = userEvent.setup();
    const forbidden = new ApiRequestError({ status: 403, statusText: "Forbidden" } as Response, {
      error_code: "catalog_import_token_forbidden",
      message: "Import token does not belong to the current user.",
      request_id: "req",
      details: {},
    });
    vi.spyOn(api, "previewCatalogImportRaw").mockRejectedValueOnce(forbidden);
    render(<OpenDialog />, { wrapper });

    await user.upload(screen.getByTestId("import-dialog-file") as HTMLInputElement, jsonFile());

    expect(await screen.findByTestId("import-dialog-error")).toHaveTextContent(
      /import preview belongs to another session/i,
    );
  });

  test("unmapped error_code uses status + statusText fallback (no doubled status)", async () => {
    const user = userEvent.setup();
    // Simulates a 5xx HTML response that ApiRequestError swallowed
    // into a synthetic `Request failed: 502 Bad Gateway` message; the
    // catch-all must prefer statusText and not produce
    // `Import failed (502): Request failed: 502 Bad Gateway`.
    const badGateway = new ApiRequestError(
      { status: 502, statusText: "Bad Gateway" } as Response,
      null,
    );
    vi.spyOn(api, "previewCatalogImportRaw").mockRejectedValueOnce(badGateway);
    render(<OpenDialog />, { wrapper });

    await user.upload(screen.getByTestId("import-dialog-file") as HTMLInputElement, jsonFile());

    const banner = await screen.findByTestId("import-dialog-error");
    expect(banner).toHaveTextContent("Import failed (502): Bad Gateway.");
    // No doubled status — the synthetic ApiRequestError message
    // ("Request failed: 502 Bad Gateway") must not appear.
    expect(banner.textContent ?? "").not.toMatch(/Request failed:/);
  });

  test("oversize 413 from the server surfaces a clean message", async () => {
    const user = userEvent.setup();
    const tooLarge = new ApiRequestError(
      { status: 413, statusText: "Payload Too Large" } as Response,
      {
        error_code: "catalog_import_too_large",
        message: "Import file exceeds 8388608 byte limit.",
        request_id: "req",
        details: {},
      },
    );
    vi.spyOn(api, "previewCatalogImportRaw").mockRejectedValueOnce(tooLarge);

    render(<OpenDialog />, { wrapper });
    await user.upload(screen.getByTestId("import-dialog-file") as HTMLInputElement, jsonFile());

    expect(await screen.findByTestId("import-dialog-error")).toHaveTextContent(/max 8 MB/);
  });
});
