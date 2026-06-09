import { describe, expect, test } from "vitest";
import { INSTALL_TYPE_SEED_OPTIONS, bootstrapInstallTypeOptions } from "../install-type-options";

describe("bootstrapInstallTypeOptions", () => {
  test("seeds the canonical five options on a fresh project", () => {
    const seeded = bootstrapInstallTypeOptions([]);

    expect(seeded.map((option) => option.label)).toEqual([
      "Cassette",
      "Wall-mounted",
      "Concealed-ducted",
      "Multi-position",
      "ERV-integrated",
    ]);
  });

  test("treats null / undefined as a fresh project", () => {
    expect(bootstrapInstallTypeOptions(null)).toHaveLength(5);
    expect(bootstrapInstallTypeOptions(undefined)).toHaveLength(5);
  });

  test("does not overwrite user-defined options", () => {
    const existing = [
      { id: "opt_custom_a", label: "Custom A" },
      { id: "opt_cassette", label: "Cassette" },
    ];

    const seeded = bootstrapInstallTypeOptions(existing);

    expect(seeded[0]).toEqual(existing[0]);
    expect(seeded[1]).toEqual(existing[1]);
    expect(seeded.filter((option) => option.id === "opt_cassette")).toHaveLength(1);
    expect(seeded.find((option) => option.id === "opt_wall_mounted")).toBeDefined();
  });

  test("seed option ids stay stable for downstream wiring", () => {
    const ids = INSTALL_TYPE_SEED_OPTIONS.map((option) => option.id);

    expect(ids).toEqual([
      "opt_cassette",
      "opt_wall_mounted",
      "opt_concealed_ducted",
      "opt_multi_position",
      "opt_erv_integrated",
    ]);
  });
});
