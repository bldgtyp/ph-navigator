// Trigger a browser download for an in-memory string or blob. Uses the
// hidden-anchor + ``URL.createObjectURL`` pattern; the URL is revoked on
// the next frame so very large blobs don't linger.
//
// Tests can pass a custom ``document`` via ``deps`` to assert what was
// downloaded without touching the real DOM.

export type DownloadDeps = {
  createObjectURL: (blob: Blob) => string;
  revokeObjectURL: (url: string) => void;
  document: Document;
};

function defaultDeps(): DownloadDeps {
  return {
    createObjectURL: URL.createObjectURL.bind(URL),
    revokeObjectURL: URL.revokeObjectURL.bind(URL),
    document,
  };
}

export function downloadJsonFile(
  payload: unknown,
  filename: string,
  deps: DownloadDeps = defaultDeps(),
): void {
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = deps.createObjectURL(blob);
  const anchor = deps.document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  deps.document.body.appendChild(anchor);
  anchor.click();
  deps.document.body.removeChild(anchor);
  // Revoke on the next tick so the click has fully resolved.
  setTimeout(() => deps.revokeObjectURL(url), 0);
}
