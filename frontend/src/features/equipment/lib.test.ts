import { describe, expect, test, vi } from "vitest";
import {
  deleteRoomPayload,
  duplicateRoomNumber,
  emptyRoom,
  nextRoomsPayload,
  optionLabel,
} from "./lib";
import type { RoomsSlice } from "./types";

const baseSlice: RoomsSlice = {
  project_id: "project-1",
  version_id: "version-1",
  source: "version",
  version_etag: "version-etag",
  draft_etag: null,
  rooms: [],
  single_select_options: {
    "rooms.floor_level": [],
    "rooms.building_zone": [],
  },
};

describe("equipment room helpers", () => {
  test("creates room options in the same Rooms payload as the row write", () => {
    vi.spyOn(globalThis.crypto, "randomUUID")
      .mockReturnValueOnce("aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa")
      .mockReturnValueOnce("bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb");
    const room = {
      id: "rm_living",
      number: " 101 ",
      name: " Living Room ",
      floor_level: null,
      building_zone: null,
      num_people: 2,
      num_bedrooms: 0,
      icfa_factor: 1,
      erv_unit_ids: [],
      catalog_origin: null,
      notes: null,
    };

    const payload = nextRoomsPayload(baseSlice, room, {
      floorLevel: "Ground",
      buildingZone: "Residential",
    });

    expect(payload.rooms).toHaveLength(1);
    expect(payload.rooms[0]?.number).toBe("101");
    expect(payload.rooms[0]?.name).toBe("Living Room");
    expect(payload.rooms[0]?.floor_level).toBe("opt_aaaaaaaaaaaa4aaaaaaaaaaaaaaaaaaa");
    expect(payload.rooms[0]?.building_zone).toBe("opt_bbbbbbbbbbbb4bbbbbbbbbbbbbbbbbbb");
    expect(payload.single_select_options["rooms.floor_level"][0]?.label).toBe("Ground");
    expect(payload.single_select_options["rooms.building_zone"][0]?.label).toBe("Residential");
  });

  test("reuses existing options case-insensitively", () => {
    const current: RoomsSlice = {
      ...baseSlice,
      single_select_options: {
        "rooms.floor_level": [{ id: "opt_ground", label: "Ground", color: "#3b82f6", order: 0 }],
        "rooms.building_zone": [],
      },
    };
    const payload = nextRoomsPayload(
      current,
      { ...emptyRoom(), id: "rm_1", number: "101", name: "Living" },
      { floorLevel: " ground ", buildingZone: "" },
    );

    expect(payload.rooms[0]?.floor_level).toBe("opt_ground");
    expect(payload.single_select_options["rooms.floor_level"]).toHaveLength(1);
    expect(payload.rooms[0]?.building_zone).toBeNull();
  });

  test("detects duplicate room numbers and deletes rows without changing options", () => {
    const room = { ...emptyRoom(), id: "rm_1", number: "101", name: "Living" };
    const other = { ...emptyRoom(), id: "rm_2", number: " 101 ", name: "Kitchen" };
    const current: RoomsSlice = { ...baseSlice, rooms: [room, other] };

    expect(duplicateRoomNumber(current.rooms, room)).toBe(true);
    expect(deleteRoomPayload(current, "rm_1").rooms).toEqual([other]);
  });

  test("resolves option labels and reports missing ids", () => {
    expect(
      optionLabel([{ id: "opt_1", label: "Ground", color: "#3b82f6", order: 0 }], "opt_1"),
    ).toBe("Ground");
    expect(optionLabel([], "opt_missing")).toBe("Missing option");
    expect(optionLabel([], null)).toBe("");
  });
});
