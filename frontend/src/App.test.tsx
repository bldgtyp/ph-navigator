import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { App } from "./App";

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  fetchMock.mockReset();
});

describe("App", () => {
  test("redirects unauthenticated root visits to sign-in with a next parameter", async () => {
    window.history.pushState({}, "", "/");
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({
        error_code: "not_authenticated",
        message: "Sign-in required.",
        request_id: "test",
        details: {},
      }),
    });

    render(<App />);

    expect(await screen.findByRole("heading", { name: "Sign in" })).toBeVisible();
    expect(window.location.pathname).toBe("/sign-in");
    expect(window.location.search).toBe("?next=%2F");
  });

  test("redirects authenticated root visits to dashboard", async () => {
    window.history.pushState({}, "", "/");
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          user: {
            id: "d39f5a2c-4c08-4085-81ab-c38d9ca30566",
            email: "ed@example.com",
            display_name: "Ed May",
          },
          expires_at: "2026-05-12T18:00:00Z",
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          user: {
            id: "d39f5a2c-4c08-4085-81ab-c38d9ca30566",
            email: "ed@example.com",
            display_name: "Ed May",
          },
          expires_at: "2026-05-12T18:00:00Z",
        }),
      });

    render(<App />);

    expect(await screen.findByRole("heading", { name: "Projects" })).toBeVisible();
    expect(window.location.pathname).toBe("/dashboard");
  });

  test("signs in and renders the empty dashboard shell", async () => {
    const user = userEvent.setup();
    window.history.pushState({}, "", "/sign-in?next=%2Fdashboard");
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          user: {
            id: "d39f5a2c-4c08-4085-81ab-c38d9ca30566",
            email: "ed@example.com",
            display_name: "Ed May",
          },
          expires_at: "2026-05-12T18:00:00Z",
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          user: {
            id: "d39f5a2c-4c08-4085-81ab-c38d9ca30566",
            email: "ed@example.com",
            display_name: "Ed May",
          },
          expires_at: "2026-05-12T18:00:00Z",
        }),
      });

    render(<App />);

    await user.type(screen.getByLabelText("Email"), "ed@example.com");
    await user.type(screen.getByLabelText("Password"), "password");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("heading", { name: "Projects" })).toBeVisible();
    expect(screen.getByText("No projects yet")).toBeVisible();
    expect(screen.getByText("Ed May")).toBeVisible();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/auth/login",
      expect.objectContaining({
        method: "POST",
        credentials: "include",
      }),
    );
  });
});
