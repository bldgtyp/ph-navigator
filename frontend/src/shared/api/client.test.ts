// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  AUTH_REQUIRED_EVENT,
  CSRF_HEADER_NAME,
  fetchDownload,
  fetchJson,
  resolveApiBaseUrl,
} from "./client";

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

  it("uses the same origin in development even with a legacy base URL", () => {
    expect(resolveApiBaseUrl(true, "http://localhost:8000")).toBe("");
  });

  it("preserves a configured API origin in production", () => {
    expect(resolveApiBaseUrl(false, "https://api.ph-nav.com")).toBe("https://api.ph-nav.com");
  });

  it("returns a server-named download and decodes RFC 5987 filenames", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response("file", {
            status: 200,
            headers: {
              "Content-Disposition":
                "attachment; filename*=UTF-8''BT-01-aperture-u-values-IP-Working%20Copy.xlsx",
            },
          }),
      ),
    );

    const download = await fetchDownload("/api/v1/download");

    expect(await download.blob.text()).toBe("file");
    expect(download.filename).toBe("BT-01-aperture-u-values-IP-Working Copy.xlsx");
  });

  it("announces a 401 so the auth route boundary can redirect an expired session", async () => {
    const onAuthRequired = vi.fn();
    window.addEventListener(AUTH_REQUIRED_EVENT, onAuthRequired);
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              error_code: "session_expired",
              message: "Your session expired after inactivity.",
              request_id: "test",
              details: {},
            }),
            { status: 401 },
          ),
      ),
    );

    await expect(fetchJson("/api/v1/auth/session")).rejects.toMatchObject({ status: 401 });
    expect(onAuthRequired).toHaveBeenCalledOnce();

    window.removeEventListener(AUTH_REQUIRED_EVENT, onAuthRequired);
  });
});
