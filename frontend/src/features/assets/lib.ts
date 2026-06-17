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
  allowedTypes: ["image/png", "image/jpeg", "image/webp"],
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
