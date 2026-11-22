import assert from "node:assert/strict";
import { test } from "node:test";
import { greet } from "../src/greeting.ts";

test("greets a trimmed name", () => {
  assert.deepEqual(greet("  Ada "), { name: "Ada", text: "Hello, Ada" });
});

test("rejects an empty name", () => {
  assert.throws(() => greet("   "), RangeError);
});
