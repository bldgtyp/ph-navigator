import { describe, expect, it } from "vitest";
import {
  applyExceptions,
  countFingerprints,
  diffAgainstBaseline,
  fingerprintOf,
  scanCssText,
  scanScriptText,
} from "./typography-scan.mjs";

describe("scanCssText", () => {
  it("accepts token-based and inherit values", () => {
    const css = `
      .a {
        font-family: var(--font-mono);
        font-size: var(--fs-md);
        font-weight: var(--fw-semibold);
        letter-spacing: var(--tracking-caps);
        line-height: var(--lh-ui);
      }
      .b { font-size: var(--data-table-font-size); line-height: inherit; }
      button { font: inherit; }
    `;
    expect(scanCssText(css, "src/a.css")).toEqual([]);
  });

  it("rejects raw sizes, weights, tracking, line heights, and families", () => {
    const css = `
      .a { font-size: 13px; font-weight: 650; letter-spacing: 0.04em; }
      .b { line-height: 1.35; font-family: monospace; }
    `;
    const properties = scanCssText(css, "src/a.css").map((violation) => violation.property);
    expect(properties.sort()).toEqual([
      "font-family",
      "font-size",
      "font-weight",
      "letter-spacing",
      "line-height",
    ]);
  });

  it("rejects the font shorthand except font: inherit", () => {
    const violations = scanCssText(".a { font: 600 14px/1.2 Geist, sans-serif; }", "src/a.css");
    expect(violations).toHaveLength(1);
    expect(violations[0].property).toBe("font");
  });

  it("rejects unapproved tokens, fallbacks, and nested functions", () => {
    const css = `
      .a { font-size: var(--my-local-size); }
      .b { font-size: var(--fs-md, 14px); }
      .c { font-size: calc(var(--fs-md) * 1.1); }
      .d { line-height: calc(1em + 2px); }
    `;
    expect(scanCssText(css, "src/a.css")).toHaveLength(4);
  });

  it("handles multiline declarations and ignores comments", () => {
    const css = `
      /* font-size: 99px; letter-spacing: 1em; */
      .a {
        font-family:
          "Geist Mono",
          monospace;
      }
    `;
    const violations = scanCssText(css, "src/a.css");
    expect(violations).toHaveLength(1);
    expect(violations[0].value).toBe('"geist mono", monospace');
    expect(violations[0].owner).toBe(".a");
  });

  it("fingerprints by file/owner/property/value, not line number", () => {
    const before = scanCssText(".a { font-size: 13px; }", "src/a.css");
    const after = scanCssText("\n\n\n.a { font-size: 13px; }", "src/a.css");
    expect(fingerprintOf(before[0])).toBe(fingerprintOf(after[0]));
  });
});

describe("scanScriptText", () => {
  it("flags inline-style and library typography props", () => {
    const source = `
      const style = { fontSize: "0.8rem", fontWeight: 600 };
      export const Chart = () => <XAxis stroke="var(--chart-axis)" fontSize={12} />;
    `;
    const properties = scanScriptText(source, "src/a.tsx").map((violation) => violation.property);
    expect(properties).toEqual(["fontSize", "fontWeight", "fontSize"]);
  });

  it("skips optional type-declaration fields", () => {
    const source = "interface Props { fontSize?: number; letterSpacing?: string }";
    expect(scanScriptText(source, "src/a.ts")).toEqual([]);
  });
});

describe("applyExceptions", () => {
  const violation = {
    file: "src/features/climate/components/ClimateRecordCharts.tsx",
    owner: "fontSize",
    property: "fontSize",
    value: "{12}",
    line: 100,
  };

  it("passes violations matched by a registered chart/canvas exception", () => {
    const { remaining, problems } = applyExceptions(
      [violation],
      [
        {
          id: "climate-chart-axis-font",
          fingerprint: fingerprintOf(violation),
          reason: "recharts axis prop cannot consume CSS classes",
        },
      ],
    );
    expect(remaining).toEqual([]);
    expect(problems).toEqual([]);
  });

  it("fails on duplicate and unused exception entries", () => {
    const entry = {
      id: "dup",
      fingerprint: "src/nope.css :: .x :: font-size :: 9px",
      reason: "r",
    };
    const { problems } = applyExceptions([violation], [entry, { ...entry }]);
    expect(problems.some((problem) => problem.includes("duplicate exception id"))).toBe(true);
    expect(problems.some((problem) => problem.includes("unused exception entry"))).toBe(true);
  });
});

describe("diffAgainstBaseline", () => {
  it("flags new debt and extra occurrences of baselined debt", () => {
    const { added, stale } = diffAgainstBaseline({ a: 2, b: 1 }, { a: 1 });
    expect(added).toEqual([
      { fingerprint: "a", count: 2, baseline: 1 },
      { fingerprint: "b", count: 1, baseline: 0 },
    ]);
    expect(stale).toEqual([]);
  });

  it("flags stale baseline entries so the ratchet only shrinks", () => {
    const { added, stale } = diffAgainstBaseline({}, { gone: 1 });
    expect(added).toEqual([]);
    expect(stale).toEqual([{ fingerprint: "gone", count: 0, baseline: 1 }]);
  });
});

describe("countFingerprints", () => {
  it("counts repeated fingerprints across media-query duplicates", () => {
    const violations = scanCssText(
      ".a { font-size: 13px; } @media (max-width: 760px) { .a { font-size: 13px; } }",
      "src/a.css",
    );
    expect(Object.values(countFingerprints(violations))).toEqual([2]);
  });
});
