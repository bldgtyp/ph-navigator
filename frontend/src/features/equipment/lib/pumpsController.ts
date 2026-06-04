import type { PumpOptionKey, PumpRow, PumpsReplacePayload, PumpsSlice } from "../types";
import type { SlicePayloadBuilders } from "../../../shared/ui/data-table/feature";
import {
  isPumpOptionKey,
  pumpsPayloadFromCellWrites,
  pumpsPayloadFromRowDelete,
  pumpsPayloadFromRowDuplicate,
  pumpsPayloadFromRowInsert,
  replacePumpOptionsPayload,
  validatePumpsPayload,
} from "../lib";

export const pumpsPayloadBuilders: SlicePayloadBuilders<PumpsSlice, PumpRow, PumpsReplacePayload> =
  {
    fromCellWrites(slice, writes, newOptions, removedOptions) {
      return pumpsPayloadFromCellWrites(slice, writes, newOptions, removedOptions);
    },
    fromRowInsert(slice, rows, build) {
      return pumpsPayloadFromRowInsert(slice, rows, build);
    },
    fromRowDelete(slice, rows) {
      return pumpsPayloadFromRowDelete(slice, rows);
    },
    fromRowDuplicate(slice, rows) {
      return pumpsPayloadFromRowDuplicate(slice, rows);
    },
    validate(payload) {
      return validatePumpsPayload(payload);
    },
    replaceOptions(slice, optionKey, options, replacements) {
      return replacePumpOptionsPayload(slice, optionKey as PumpOptionKey, options, replacements);
    },
    isLegacyOptionKey(key) {
      return isPumpOptionKey(key);
    },
  };
