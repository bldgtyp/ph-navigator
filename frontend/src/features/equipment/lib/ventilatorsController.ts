import type {
  VentilatorOptionKey,
  VentilatorRow,
  VentilatorsReplacePayload,
  VentilatorsSlice,
} from "../types";
import type { SlicePayloadBuilders } from "../../../shared/ui/data-table/feature";
import {
  isVentilatorOptionKey,
  replaceVentilatorOptionsPayload,
  validateVentilatorsPayload,
  ventilatorsPayloadFromCellWrites,
  ventilatorsPayloadFromRowDelete,
  ventilatorsPayloadFromRowDuplicate,
  ventilatorsPayloadFromRowInsert,
} from "../lib";

export const ventilatorsPayloadBuilders: SlicePayloadBuilders<
  VentilatorsSlice,
  VentilatorRow,
  VentilatorsReplacePayload
> = {
  rows: (slice) => slice.ventilators,
  fromCellWrites(slice, writes, newOptions, removedOptions) {
    return ventilatorsPayloadFromCellWrites(slice, writes, newOptions, removedOptions);
  },
  fromRowInsert(slice, rows, build) {
    return ventilatorsPayloadFromRowInsert(slice, rows, build);
  },
  fromRowDelete(slice, rows) {
    return ventilatorsPayloadFromRowDelete(slice, rows);
  },
  fromRowDuplicate(slice, rows) {
    return ventilatorsPayloadFromRowDuplicate(slice, rows);
  },
  validate(payload) {
    return validateVentilatorsPayload(payload);
  },
  replaceOptions(slice, optionKey, options, replacements) {
    return replaceVentilatorOptionsPayload(
      slice,
      optionKey as VentilatorOptionKey,
      options,
      replacements,
    );
  },
  isLegacyOptionKey(key) {
    return isVentilatorOptionKey(key);
  },
};
