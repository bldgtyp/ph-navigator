import { useMemo, useSyncExternalStore } from "react";
import {
  getDraftWriteCoordinator,
  type DraftWriteCoordinator,
  type DraftWriteStatus,
} from "./draftWriteCoordinator";

const IDLE_STATUS: DraftWriteStatus = { queued: 0, inFlight: false };

export function useDraftWriteCoordinator(
  projectId: string,
  versionId: string | null,
): { coordinator: DraftWriteCoordinator | null; status: DraftWriteStatus } {
  const coordinator = useMemo(
    () => (versionId ? getDraftWriteCoordinator(projectId, versionId) : null),
    [projectId, versionId],
  );
  const status = useSyncExternalStore(
    coordinator?.subscribe ?? emptySubscribe,
    coordinator?.status ?? idleSnapshot,
    coordinator?.status ?? idleSnapshot,
  );
  return { coordinator, status };
}

function emptySubscribe(): () => void {
  return () => undefined;
}

function idleSnapshot(): DraftWriteStatus {
  return IDLE_STATUS;
}
