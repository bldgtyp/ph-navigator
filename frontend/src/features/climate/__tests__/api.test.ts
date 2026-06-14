import { describe, expect, test } from "vitest";
import { buildLocationQuery } from "../api";

describe("buildLocationQuery", () => {
  test("empty search yields no query string", () => {
    expect(buildLocationQuery({})).toBe("");
  });

  test("country/region/limit/offset pass through", () => {
    const query = buildLocationQuery({ country: "US", region: "MA", limit: 25, offset: 50 });
    const params = new URLSearchParams(query);
    expect(params.get("country")).toBe("US");
    expect(params.get("region")).toBe("MA");
    expect(params.get("limit")).toBe("25");
    expect(params.get("offset")).toBe("50");
  });

  test("near serializes as 'lat,long'", () => {
    const query = buildLocationQuery({ near: { latitude: 40, longitude: -105 } });
    expect(new URLSearchParams(query).get("near")).toBe("40,-105");
  });
});
