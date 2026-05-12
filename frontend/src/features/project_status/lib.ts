import type { StatusItem, StatusState } from "./types";

export const STATUS_STATES = ["todo", "done", "na"] as const;

export const STATUS_STATE_LABELS: Record<StatusState, string> = {
  todo: "To do",
  done: "Done",
  na: "N/A",
};

export const STATUS_STATE_OPTIONS = STATUS_STATES.map((state) => ({
  value: state,
  label: STATUS_STATE_LABELS[state],
}));

export function isStatusState(value: string): value is StatusState {
  return STATUS_STATES.includes(value as StatusState);
}

export function nextStatusState(state: StatusState): StatusState {
  if (state === "todo") return "done";
  if (state === "done") return "na";
  return "todo";
}

export function stateSymbol(state: StatusState): string {
  if (state === "done") return "x";
  if (state === "na") return "-";
  return "o";
}

export function sortStatusItems(items: StatusItem[]): StatusItem[] {
  return [...items].sort(
    (a, b) => a.order_index - b.order_index || a.created_at.localeCompare(b.created_at),
  );
}

export function orderIndexForMove(
  items: StatusItem[],
  itemId: string,
  direction: -1 | 1,
): number | null {
  const currentIndex = items.findIndex((item) => item.id === itemId);
  const targetIndex = currentIndex + direction;
  if (currentIndex < 0 || targetIndex < 0 || targetIndex >= items.length) return null;
  const reordered = [...items];
  const [item] = reordered.splice(currentIndex, 1);
  if (!item) return null;
  reordered.splice(targetIndex, 0, item);
  const before = reordered[targetIndex - 1]?.order_index;
  const after = reordered[targetIndex + 1]?.order_index;
  if (before === undefined && after === undefined) return 1;
  if (before === undefined) return (after ?? item.order_index) - 1;
  if (after === undefined) return before + 1;
  return (before + after) / 2;
}
