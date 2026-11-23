#!/usr/bin/env node
import { readFileSync } from "node:fs";

const mode = readFileSync(process.env.FAKE_CHECK, "utf8").trim();
if (mode === "pass") {
  console.log(`[add-delete] target: deployed app at ${process.env.VERIFY_BASE_URL}`);
  console.log('[add-delete] feature "add-delete" PASSED');
  process.exit(0);
}
console.error(`[add-delete] FAILED: Error: ${mode}\n    at somewhere`);
process.exit(1);
