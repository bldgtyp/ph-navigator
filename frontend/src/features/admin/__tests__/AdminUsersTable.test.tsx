import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AdminUsersTable, type AdminUserActions } from "../components/AdminUsersTable";
import type { AdminUser } from "../types";

function buildUser(overrides: Partial<AdminUser> = {}): AdminUser {
  return {
    id: "u1",
    email: "john@example.com",
    display_name: "John",
    status: "active",
    role: "user",
    is_staff: false,
    created_at: "2026-06-27T12:00:00Z",
    last_action_at: null,
    ...overrides,
  };
}

function noopActions(overrides: Partial<AdminUserActions> = {}): AdminUserActions {
  return {
    onChangeName: vi.fn(),
    onChangeEmail: vi.fn(),
    onResetLink: vi.fn(),
    onDeactivate: vi.fn(),
    onReactivate: vi.fn(),
    onToggleAdmin: vi.fn(),
    onViewAudit: vi.fn(),
    ...overrides,
  };
}

describe("AdminUsersTable", () => {
  it("renders status and role chips", () => {
    render(
      <AdminUsersTable
        users={[buildUser({ status: "invited", role: "admin" })]}
        actions={noopActions()}
      />,
    );
    expect(screen.getByText("Invited")).toBeInTheDocument();
    expect(screen.getByText("Admin")).toBeInTheDocument();
  });

  it("offers Deactivate for an active user and forwards the click", async () => {
    const user = userEvent.setup();
    const onDeactivate = vi.fn();
    render(<AdminUsersTable users={[buildUser()]} actions={noopActions({ onDeactivate })} />);

    await user.click(screen.getByRole("button", { name: /Actions for john@example.com/ }));
    await user.click(screen.getByRole("menuitem", { name: "Deactivate" }));

    expect(onDeactivate).toHaveBeenCalledTimes(1);
  });

  it("offers Change Name and Change Email actions", async () => {
    const user = userEvent.setup();
    const onChangeName = vi.fn();
    const onChangeEmail = vi.fn();
    render(
      <AdminUsersTable
        users={[buildUser()]}
        actions={noopActions({ onChangeName, onChangeEmail })}
      />,
    );

    await user.click(screen.getByRole("button", { name: /Actions for john@example.com/ }));
    await user.click(screen.getByRole("menuitem", { name: "Change Name" }));
    expect(onChangeName).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: /Actions for john@example.com/ }));
    await user.click(screen.getByRole("menuitem", { name: "Change Email" }));
    expect(onChangeEmail).toHaveBeenCalledTimes(1);
  });

  it("offers Reactivate for an inactive user instead of Deactivate", async () => {
    const user = userEvent.setup();
    render(<AdminUsersTable users={[buildUser({ status: "inactive" })]} actions={noopActions()} />);

    await user.click(screen.getByRole("button", { name: /Actions for john@example.com/ }));
    expect(screen.getByRole("menuitem", { name: "Reactivate" })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Deactivate" })).not.toBeInTheDocument();
  });
});
