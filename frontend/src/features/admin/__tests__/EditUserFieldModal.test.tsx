import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { EditUserFieldModal } from "../components/EditUserFieldModal";
import * as api from "../api";
import type { AdminUser } from "../types";

const ADMIN_USER: AdminUser = {
  id: "u1",
  email: "john@example.com",
  display_name: "John",
  status: "active",
  role: "user",
  is_staff: false,
  created_at: "2026-06-27T12:00:00Z",
  last_action_at: null,
};

function renderModal(field: "name" | "email", onClose = vi.fn()) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <EditUserFieldModal user={ADMIN_USER} field={field} onClose={onClose} />
    </QueryClientProvider>,
  );
}

describe("EditUserFieldModal", () => {
  it("submits a changed display name", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const update = vi.spyOn(api, "updateUserName").mockResolvedValue({
      ...ADMIN_USER,
      display_name: "John Mitchell",
    });

    renderModal("name", onClose);

    const input = screen.getByLabelText("Name");
    await user.clear(input);
    await user.type(input, "John Mitchell");
    await user.click(screen.getByRole("button", { name: "OK" }));

    await waitFor(() => expect(update).toHaveBeenCalledWith("u1", "John Mitchell"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("submits a changed email", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const update = vi.spyOn(api, "updateUserEmail").mockResolvedValue({
      ...ADMIN_USER,
      email: "john@bldgtyp.com",
    });

    renderModal("email", onClose);

    const input = screen.getByLabelText("Email");
    await user.clear(input);
    await user.type(input, "john@bldgtyp.com");
    await user.click(screen.getByRole("button", { name: "OK" }));

    await waitFor(() => expect(update).toHaveBeenCalledWith("u1", "john@bldgtyp.com"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
