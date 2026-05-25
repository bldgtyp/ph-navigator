// Parity test for D23 resource-limit constants. Reads the Python source
// file as text and asserts every TS constant matches its Python sibling
// — drift in either direction fails CI before behavior tests do.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  AST_DEPTH_MAX,
  AST_NODE_COUNT_MAX,
  DEP_COUNT_MAX,
  OUTPUT_LENGTH_MAX,
  PER_ROW_FUSE_MAX,
  SOURCE_LENGTH_MAX,
} from "../lib/formula/limits";

const PY_PATH = resolve(
  __dirname,
  "../../../../../../backend/features/project_document/formula/limits.py",
);

function readConst(source: string, name: string): number {
  const re = new RegExp(`^${name}\\s*=\\s*(\\d+)\\s*$`, "m");
  const match = re.exec(source);
  if (match === null) {
    throw new Error(`could not locate ${name} in ${PY_PATH}`);
  }
  return Number(match[1]);
}

describe("formula limits parity", () => {
  const pySource = readFileSync(PY_PATH, "utf-8");

  const pairs: ReadonlyArray<[string, number]> = [
    ["SOURCE_LENGTH_MAX", SOURCE_LENGTH_MAX],
    ["AST_NODE_COUNT_MAX", AST_NODE_COUNT_MAX],
    ["AST_DEPTH_MAX", AST_DEPTH_MAX],
    ["DEP_COUNT_MAX", DEP_COUNT_MAX],
    ["OUTPUT_LENGTH_MAX", OUTPUT_LENGTH_MAX],
    ["PER_ROW_FUSE_MAX", PER_ROW_FUSE_MAX],
  ];

  for (const [name, tsValue] of pairs) {
    it(`${name} matches Python`, () => {
      expect(tsValue).toBe(readConst(pySource, name));
    });
  }
});
