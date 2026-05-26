export function emptyDetailMessage(typeCount: number, canEdit: boolean): string {
  if (typeCount > 0) return "Select a window type from the list.";
  return canEdit
    ? "No window types yet. Add one to start picking frames and glazing."
    : "No window types in this version yet.";
}
