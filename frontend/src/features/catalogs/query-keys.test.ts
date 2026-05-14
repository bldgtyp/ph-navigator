import { describe, expect, test } from "vitest";
import { catalogQueryKeys } from "./query-keys";

describe("catalogQueryKeys", () => {
  test("materialsList key includes the includeInactive filter so caches do not collide", () => {
    const active = catalogQueryKeys.materialsList(false);
    const inactive = catalogQueryKeys.materialsList(true);
    expect(active).not.toEqual(inactive);
  });

  test("all material keys share the materials root for bulk invalidation", () => {
    const root = catalogQueryKeys.materials();
    expect(catalogQueryKeys.materialsList(false).slice(0, root.length)).toEqual(root);
    expect(catalogQueryKeys.material("mat_x").slice(0, root.length)).toEqual(root);
  });
});
