import { useEffect, useRef, useState } from "react";
import { downloadBlob } from "../lib/downloadBlob";
import { errorMessage } from "../lib/errors";

export type DownloadFile = { blob: Blob; filename: string | null };

export function useDownloadExport<T>({
  scopeKey,
  request,
  fallbackFilename,
  errorFallback,
  onError,
  saveBlob = downloadBlob,
}: {
  scopeKey: string;
  request: (value: T, signal: AbortSignal) => Promise<DownloadFile>;
  fallbackFilename: (value: T) => string;
  errorFallback: string;
  onError: (message: string | null) => void;
  saveBlob?: typeof downloadBlob;
}) {
  const activeRequest = useRef(false);
  const requestController = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  const [busyValue, setBusyValue] = useState<T | null>(null);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      requestController.current?.abort();
    };
  }, [scopeKey]);

  async function download(value: T): Promise<boolean> {
    if (activeRequest.current) return false;
    activeRequest.current = true;
    const controller = new AbortController();
    requestController.current = controller;
    setBusyValue(value);
    onError(null);
    try {
      const file = await request(value, controller.signal);
      if (controller.signal.aborted || !mounted.current) return false;
      saveBlob(file.blob, file.filename ?? fallbackFilename(value));
      return true;
    } catch (error) {
      if (controller.signal.aborted) return false;
      onError(errorMessage(error, errorFallback));
      return false;
    } finally {
      activeRequest.current = false;
      if (requestController.current === controller) requestController.current = null;
      if (mounted.current) setBusyValue(null);
    }
  }

  return { download, busy: busyValue !== null, busyValue };
}
