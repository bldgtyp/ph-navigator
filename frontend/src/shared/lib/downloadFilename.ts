export function downloadFilenamePart(value: string, fallback: string): string {
  return (
    value
      .replace(/[^A-Za-z0-9_-]+/g, "-")
      .replace(/^[-_]+|[-_]+$/g, "")
      .slice(0, 80)
      .replace(/[-_]+$/g, "") || fallback
  );
}
