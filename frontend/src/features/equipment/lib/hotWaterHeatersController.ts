import type {
  HotWaterHeaterOptionKey,
  HotWaterHeaterRow,
  HotWaterHeatersReplacePayload,
  HotWaterHeatersSlice,
} from "../types";
import type { SlicePayloadBuilders } from "../../../shared/ui/data-table/feature";
import {
  hotWaterHeatersPayloadFromCellWrites,
  hotWaterHeatersPayloadFromRowDelete,
  hotWaterHeatersPayloadFromRowDuplicate,
  hotWaterHeatersPayloadFromRowInsert,
  isHotWaterHeaterOptionKey,
  replaceHotWaterHeaterOptionsPayload,
  validateHotWaterHeatersPayload,
} from "../lib";

export const hotWaterHeatersPayloadBuilders: SlicePayloadBuilders<
  HotWaterHeatersSlice,
  HotWaterHeaterRow,
  HotWaterHeatersReplacePayload
> = {
  fromCellWrites(slice, writes, newOptions, removedOptions) {
    return hotWaterHeatersPayloadFromCellWrites(slice, writes, newOptions, removedOptions);
  },
  fromRowInsert(slice, rows, build) {
    return hotWaterHeatersPayloadFromRowInsert(slice, rows, build);
  },
  fromRowDelete(slice, rows) {
    return hotWaterHeatersPayloadFromRowDelete(slice, rows);
  },
  fromRowDuplicate(slice, rows) {
    return hotWaterHeatersPayloadFromRowDuplicate(slice, rows);
  },
  validate(payload) {
    return validateHotWaterHeatersPayload(payload);
  },
  replaceOptions(slice, optionKey, options, replacements) {
    return replaceHotWaterHeaterOptionsPayload(
      slice,
      optionKey as HotWaterHeaterOptionKey,
      options,
      replacements,
    );
  },
  isLegacyOptionKey(key) {
    return isHotWaterHeaterOptionKey(key);
  },
};
