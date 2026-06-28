import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CSRF_HEADER_NAME, fetchJson } from "./client";

describe("api client", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 })),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends the app-only CSRF header on every request", async () => {
    await fetchJson("/api/v1/admin/users");

    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = new Headers(init.headers);

    expect(headers.get(CSRF_HEADER_NAME)).toBe("1");
    expect(headers.get("X-Request-ID")).toBeTruthy();
    expect(init.credentials).toBe("include");
  });

  it("does not override a multipart Content-Type but still sends the CSRF header", async () => {
    const body = new FormData();
    await fetchJson("/api/v1/admin/users", { method: "POST", body });

    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = new Headers(init.headers);

    expect(headers.has("Content-Type")).toBe(false);
    expect(headers.get(CSRF_HEADER_NAME)).toBe("1");
  });
});
