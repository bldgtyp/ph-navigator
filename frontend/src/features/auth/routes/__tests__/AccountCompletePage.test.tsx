import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Link, MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AccountCompletePage } from "../AccountCompletePage";

function renderPage(initialEntry: string, mode: "invite" | "reset" = "invite") {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <AccountCompletePage mode={mode} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function renderResetPageWithSecondLink() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/reset#token=first-token"]}>
        <Link to="/reset#token=second-token">Open second reset link</Link>
        <AccountCompletePage mode="reset" />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("AccountCompletePage", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 204 })),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows an error shell when the link has no token", () => {
    renderPage("/invite");
    expect(screen.getByText("Link not valid")).toBeInTheDocument();
  });

  it("blocks submission when passwords do not match", async () => {
    const user = userEvent.setup();
    renderPage("/invite#token=abc123");

    await user.type(screen.getByLabelText("New password"), "longenough");
    await user.type(screen.getByLabelText("Confirm password"), "different1");

    expect(screen.getByText("Passwords do not match.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Set password" })).toBeDisabled();
  });

  it("posts the token from the fragment and shows success", async () => {
    const user = userEvent.setup();
    renderPage("/invite#token=abc123");

    await user.type(screen.getByLabelText("New password"), "longenough");
    await user.type(screen.getByLabelText("Confirm password"), "longenough");
    await user.click(screen.getByRole("button", { name: "Set password" }));

    await waitFor(() => expect(screen.getByText("Password set")).toBeInTheDocument());
    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/api/v1/auth/invite/complete");
    expect(JSON.parse(init.body as string)).toMatchObject({
      token: "abc123",
      password: "longenough",
    });
  });

  it("starts a fresh form when a same-tab reset link changes token", async () => {
    const user = userEvent.setup();
    renderResetPageWithSecondLink();

    await user.type(screen.getByLabelText("New password"), "firstpass");
    await user.type(screen.getByLabelText("Confirm password"), "firstpass");
    await user.click(screen.getByRole("button", { name: "Update password" }));
    await waitFor(() => expect(screen.getByText("Password set")).toBeInTheDocument());

    await user.click(screen.getByRole("link", { name: "Open second reset link" }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Choose a new password" })).toBeInTheDocument();
    });
    expect(screen.queryByText("Password set")).not.toBeInTheDocument();
    expect(screen.getByLabelText("New password")).toHaveValue("");
    expect(screen.getByLabelText("Confirm password")).toHaveValue("");

    await user.type(screen.getByLabelText("New password"), "secondpass");
    await user.type(screen.getByLabelText("Confirm password"), "secondpass");
    await user.click(screen.getByRole("button", { name: "Update password" }));

    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const [url, init] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(url).toContain("/api/v1/auth/reset/complete");
    expect(JSON.parse(init.body as string)).toMatchObject({
      token: "second-token",
      password: "secondpass",
    });
  });
});
