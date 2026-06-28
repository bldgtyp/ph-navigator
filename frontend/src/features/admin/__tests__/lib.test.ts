import { describe, expect, it } from "vitest";
import type { AuthSession } from "../../auth/types";
import { ADMIN_USERS_MANAGE, canManageUsers, roleLabel, statusLabel } from "../lib";

function session(capabilities: string[]): AuthSession {
  return {
    user: { id: "u1", email: "ed@example.com", display_name: "Ed", units_preference: "SI" },
    expires_at: "2026-06-27T12:00:00Z",
    capabilities,
  };
}

describe("admin lib", () => {
  it("gates on the admin.users.manage capability", () => {
    expect(canManageUsers(session([ADMIN_USERS_MANAGE]))).toBe(true);
    expect(canManageUsers(session([]))).toBe(false);
    expect(canManageUsers(session(["catalog.edit"]))).toBe(false);
  });

  it("labels statuses and roles", () => {
    expect(statusLabel("invited")).toBe("Invited");
    expect(statusLabel("inactive")).toBe("Inactive");
    expect(roleLabel("admin")).toBe("Admin");
    expect(roleLabel("user")).toBe("User");
  });
});
