/** Shared helpers for the font-audit scripts (audit, sweep, aggregate, eval). */

export const KNOWN_WEIGHTS = new Set(["400", "500", "600", "700"]);

/** Value of a `--flag value` CLI pair, or the fallback when absent. */
export function argValue(flag, fallback) {
  const index = process.argv.indexOf(flag);
  return index === -1 ? fallback : process.argv[index + 1];
}

/** Top-n entries of a {key: count} histogram as "key (count), …". */
export function top(obj, n = 4) {
  return Object.entries(obj)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([k, c]) => `${k} (${c})`)
    .join(", ");
}

/** style/transform/letter-spacing cell, "—" when all default. */
export function formatExtras(v) {
  return (
    [
      v.style !== "normal" ? v.style : "",
      v.transform !== "none" ? v.transform : "",
      v.letterSpacing !== "normal" ? v.letterSpacing : "",
    ]
      .filter(Boolean)
      .join(" / ") || "—"
  );
}

/** Weight cell; bold-flags weights outside the standard 400/500/600/700 set. */
export function formatWeight(weight) {
  return KNOWN_WEIGHTS.has(weight) ? weight : `**${weight}?**`;
}

/** A variant is off-scale when its size has no token or its weight is odd. */
export function isOffScale(v) {
  return v.sizeToken === "OFF-SCALE" || !KNOWN_WEIGHTS.has(v.weight);
}
