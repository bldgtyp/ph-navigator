import type { FanOptionKey, FanRow, FansReplacePayload, FansSlice } from "../types";
import type { SlicePayloadBuilders } from "../../../shared/ui/data-table/feature";
import {
  fansPayloadFromCellWrites,
  fansPayloadFromRowDelete,
  fansPayloadFromRowDuplicate,
  fansPayloadFromRowInsert,
  isFanOptionKey,
  replaceFanOptionsPayload,
  validateFansPayload,
} from "../lib";

export const fansPayloadBuilders: SlicePayloadBuilders<FansSlice, FanRow, FansReplacePayload> = {
  fromCellWrites(slice, writes, newOptions, removedOptions) {
    return fansPayloadFromCellWrites(slice, writes, newOptions, removedOptions);
  },
  fromRowInsert(slice, rows, build) {
    return fansPayloadFromRowInsert(slice, rows, build);
  },
  fromRowDelete(slice, rows) {
    return fansPayloadFromRowDelete(slice, rows);
  },
  fromRowDuplicate(slice, rows) {
    return fansPayloadFromRowDuplicate(slice, rows);
  },
  validate(payload) {
    return validateFansPayload(payload);
  },
  replaceOptions(slice, optionKey, options, replacements) {
    return replaceFanOptionsPayload(slice, optionKey as FanOptionKey, options, replacements);
  },
  isLegacyOptionKey(key) {
    return isFanOptionKey(key);
  },
};
