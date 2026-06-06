import type {
  HotWaterTankOptionKey,
  HotWaterTankRow,
  HotWaterTanksReplacePayload,
  HotWaterTanksSlice,
} from "../types";
import type { SlicePayloadBuilders } from "../../../shared/ui/data-table/feature";
import {
  hotWaterTanksPayloadFromCellWrites,
  hotWaterTanksPayloadFromRowDelete,
  hotWaterTanksPayloadFromRowDuplicate,
  hotWaterTanksPayloadFromRowInsert,
  isHotWaterTankOptionKey,
  replaceHotWaterTankOptionsPayload,
  validateHotWaterTanksPayload,
} from "../lib";

export const hotWaterTanksPayloadBuilders: SlicePayloadBuilders<
  HotWaterTanksSlice,
  HotWaterTankRow,
  HotWaterTanksReplacePayload
> = {
  fromCellWrites(slice, writes, newOptions, removedOptions) {
    return hotWaterTanksPayloadFromCellWrites(slice, writes, newOptions, removedOptions);
  },
  fromRowInsert(slice, rows, build) {
    return hotWaterTanksPayloadFromRowInsert(slice, rows, build);
  },
  fromRowDelete(slice, rows) {
    return hotWaterTanksPayloadFromRowDelete(slice, rows);
  },
  fromRowDuplicate(slice, rows) {
    return hotWaterTanksPayloadFromRowDuplicate(slice, rows);
  },
  validate(payload) {
    return validateHotWaterTanksPayload(payload);
  },
  replaceOptions(slice, optionKey, options, replacements) {
    return replaceHotWaterTankOptionsPayload(
      slice,
      optionKey as HotWaterTankOptionKey,
      options,
      replacements,
    );
  },
  isLegacyOptionKey(key) {
    return isHotWaterTankOptionKey(key);
  },
};
