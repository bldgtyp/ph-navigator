import type { RoomsSlice } from "../types";

export function emptyRoomsSlice(): RoomsSlice {
  return {
    project_id: "",
    version_id: "",
    rooms: [],
    field_defs: [],
    single_select_options: {
      "rooms.floor_level": [],
      "rooms.building_zone": [],
    },
    version_etag: "",
    rows_computed: {},
    source: "draft",
    draft_etag: null,
    inverse_links: {},
    inverse_link_fields: [],
    inverse_links_fingerprint: "",
  };
}
