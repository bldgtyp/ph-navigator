import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { LoadingChip } from "../components/LoadingChip";

const diagnostic =
  "Invalid HBJSON: a long program diagnostic\nMissing equipment_collection\nRequest ID: request-123";

describe("model load failures", () => {
  it("keeps the full diagnostic available and copies it with the filename", async () => {
    const user = userEvent.setup();
    const write = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();
    render(
      <LoadingChip
        phase="error"
        errorKind="permanent"
        errorMessage={diagnostic}
        fileName="Synthetic model"
        loadSummary={null}
        onRetry={vi.fn()}
      />,
    );
    expect(screen.getByRole("alert").textContent).toContain(diagnostic);
    expect(screen.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Copy error details" }));
    expect(write).toHaveBeenCalledWith(`Synthetic model\n\n${diagnostic}`);
    expect(screen.getByRole("status")).toHaveTextContent("Details copied.");
  });

  it("offers retry for transient failures and a manual-copy fallback", async () => {
    const user = userEvent.setup();
    vi.spyOn(navigator.clipboard, "writeText").mockRejectedValue(new Error("denied"));
    const retry = vi.fn();
    render(
      <LoadingChip
        phase="error"
        errorKind="transient"
        errorMessage={diagnostic}
        loadSummary={null}
        onRetry={retry}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(retry).toHaveBeenCalledOnce();
    await user.click(screen.getByRole("button", { name: "Copy error details" }));
    expect(screen.getByRole("status")).toHaveTextContent("Select and copy the details above.");
  });
});
