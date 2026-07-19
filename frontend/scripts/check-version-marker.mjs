import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const expectedSha = (
  process.env.RENDER_GIT_COMMIT ||
  process.env.GIT_SHA ||
  execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim()
).toLowerCase();
const marker = JSON.parse(readFileSync(new URL("../dist/version.json", import.meta.url), "utf8"));

if (!/^[0-9a-f]{40}$/.test(expectedSha) || marker.git_sha !== expectedSha) {
  throw new Error(
    `dist/version.json git_sha mismatch: expected ${expectedSha}, received ${String(marker.git_sha)}`,
  );
}

console.log(`Frontend version marker verified at ${expectedSha}.`);
