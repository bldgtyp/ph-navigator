import { describe, expect, test } from "vitest";
import { catalogQueryKeys } from "./query-keys";

describe("catalogQueryKeys", () => {
  test("all material keys share the materials root for bulk invalidation", () => {
    const root = catalogQueryKeys.materials();
    expect(catalogQueryKeys.materialsList().slice(0, root.length)).toEqual(root);
    expect(catalogQueryKeys.material("recABCDEFGHIJKLMN").slice(0, root.length)).toEqual(root);
  });

  test("frame-type and glazing-type list keys share their respective roots", () => {
    const frameRoot = catalogQueryKeys.frameTypes();
    expect(catalogQueryKeys.frameTypesList().slice(0, frameRoot.length)).toEqual(frameRoot);
    const glazingRoot = catalogQueryKeys.glazingTypes();
    expect(catalogQueryKeys.glazingTypesList().slice(0, glazingRoot.length)).toEqual(glazingRoot);
  });
});
