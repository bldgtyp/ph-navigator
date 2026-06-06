import type {
  ApplianceOptionKey,
  ApplianceRow,
  AppliancesReplacePayload,
  AppliancesSlice,
} from "../types";
import type { SlicePayloadBuilders } from "../../../shared/ui/data-table/feature";
import {
  appliancesPayloadFromCellWrites,
  appliancesPayloadFromRowDelete,
  appliancesPayloadFromRowDuplicate,
  appliancesPayloadFromRowInsert,
  isApplianceOptionKey,
  replaceApplianceOptionsPayload,
  validateAppliancesPayload,
} from "../lib";

export const appliancesPayloadBuilders: SlicePayloadBuilders<
  AppliancesSlice,
  ApplianceRow,
  AppliancesReplacePayload
> = {
  fromCellWrites(slice, writes, newOptions, removedOptions) {
    return appliancesPayloadFromCellWrites(slice, writes, newOptions, removedOptions);
  },
  fromRowInsert(slice, rows, build) {
    return appliancesPayloadFromRowInsert(slice, rows, build);
  },
  fromRowDelete(slice, rows) {
    return appliancesPayloadFromRowDelete(slice, rows);
  },
  fromRowDuplicate(slice, rows) {
    return appliancesPayloadFromRowDuplicate(slice, rows);
  },
  validate(payload) {
    return validateAppliancesPayload(payload);
  },
  replaceOptions(slice, optionKey, options, replacements) {
    return replaceApplianceOptionsPayload(
      slice,
      optionKey as ApplianceOptionKey,
      options,
      replacements,
    );
  },
  isLegacyOptionKey(key) {
    return isApplianceOptionKey(key);
  },
};
