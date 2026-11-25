/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

import { describe, it } from "vitest";

function exportedNames(file: URL): readonly string[] {
  const source: string = readFileSync(file, "utf8");
  const listed: readonly string[] = [...source.matchAll(/^export \{([^}]*)\}/gmu)].flatMap(t => (t[1] ?? "").split(","));
  const declared: readonly string[] = [...source.matchAll(/^export (?:declare )?(?:abstract )?(?:const|class) (\w+)/gmu)].map(t => t[1] ?? "");
  return [...listed, ...declared].map(t => t.trim()).filter(t => t !== "").sort();
}

describe("the window entry", () => {
  it("re-exports every name the installed window package declares, and its declarations name the same", () => {
    const entry: string = createRequire(import.meta.url).resolve("@noldova/terminal.window");
    const window: readonly string[] = exportedNames(pathToFileURL(entry.replace(/\.js$/u, ".d.ts")));

    assert.deepEqual(exportedNames(new URL("../../src/api/window.ts", import.meta.url)), window);
    assert.deepEqual(exportedNames(new URL("../../src/api/window.d.ts", import.meta.url)), window);
  });
});
