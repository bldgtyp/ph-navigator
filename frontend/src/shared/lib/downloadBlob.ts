export function downloadUrl(url: string, filename = "", target?: "_blank"): void {
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  if (target) {
    link.target = target;
    link.rel = "noopener noreferrer";
  }
  document.body.append(link);
  try {
    link.click();
  } finally {
    link.remove();
  }
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  try {
    downloadUrl(url, filename);
  } finally {
    URL.revokeObjectURL(url);
  }
}
