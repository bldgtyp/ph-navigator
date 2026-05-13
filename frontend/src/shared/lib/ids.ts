export function generatedId(prefix: string): string {
  const random = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
  return `${prefix}_${random.replace(/[^A-Za-z0-9]/g, "")}`;
}
