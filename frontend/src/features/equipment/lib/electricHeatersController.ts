import type {
  ElectricHeaterRow,
  ElectricHeatersReplacePayload,
  ElectricHeatersSlice,
} from "../types";
import type { SlicePayloadBuilders } from "../../../shared/ui/data-table/feature";
import {
  electricHeatersPayloadFromCellWrites,
  electricHeatersPayloadFromRowDelete,
  electricHeatersPayloadFromRowDuplicate,
  electricHeatersPayloadFromRowInsert,
  validateElectricHeatersPayload,
} from "../lib";

export const electricHeatersPayloadBuilders: SlicePayloadBuilders<
  ElectricHeatersSlice,
  ElectricHeaterRow,
  ElectricHeatersReplacePayload
> = {
  fromCellWrites(slice, writes) {
    return electricHeatersPayloadFromCellWrites(slice, writes);
  },
  fromRowInsert(slice, rows, build) {
    return electricHeatersPayloadFromRowInsert(slice, rows, build);
  },
  fromRowDelete(slice, rows) {
    return electricHeatersPayloadFromRowDelete(slice, rows);
  },
  fromRowDuplicate(slice, rows) {
    return electricHeatersPayloadFromRowDuplicate(slice, rows);
  },
  validate(payload) {
    return validateElectricHeatersPayload(payload);
  },
};
