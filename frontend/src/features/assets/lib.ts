import type { AttachmentFieldConfig } from "./types";
import { sameOrderedStrings } from "../../shared/lib/arrays";

export const DATASHEET_ATTACHMENT_CONFIG: AttachmentFieldConfig = {
  assetKind: "datasheet",
  allowedTypes: ["application/pdf", "image/png", "image/jpeg", "image/webp"],
  maxCount: 5,
  maxFileSizeMb: 25,
};

export const SITE_PHOTO_ATTACHMENT_CONFIG: AttachmentFieldConfig = {
  assetKind: "site_photo",
  allowedTypes: ["image/png", "image/jpeg", "image/webp", "image/heic", "image/heif"],
  maxCount: 10,
  maxFileSizeMb: 25,
};

export function readAttachmentAssetIds(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

export function sameAttachmentAssetIds(a: readonly string[], b: readonly string[]): boolean {
  return sameOrderedStrings(a, b);
}

export function uniqueAttachmentAssetIds<TRow>(
  rows: readonly TRow[],
  ...getters: Array<(row: TRow) => readonly string[]>
): string[] {
  return Array.from(new Set(rows.flatMap((row) => getters.flatMap((getter) => getter(row)))));
}
