/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { describe, it } from "vitest";

function exportedNames(file: URL): readonly string[] {
  const source: string = readFileSync(file, "utf8");
  const listed: readonly string[] = [...source.matchAll(/^export \{([^}]*)\}/gmu)].flatMap(t => (t[1] ?? "").split(","));
  const declared: readonly string[] = [...source.matchAll(/^export const (\w+)/gmu)].map(t => t[1] ?? "");
  return [...listed, ...declared].map(t => t.trim()).filter(t => t !== "").sort();
}

describe("the window entry", () => {
  it("re-exports every name the window package exports, and its declarations name the same", () => {
    const window: readonly string[] = exportedNames(new URL("../../../noldova.terminal.window/src/api/index.ts", import.meta.url));

    assert.deepEqual(exportedNames(new URL("../../src/api/window.ts", import.meta.url)), window);
    assert.deepEqual(exportedNames(new URL("../../src/api/window.d.ts", import.meta.url)), window);
  });
});
