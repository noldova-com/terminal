/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

import type { Terminal as XtermTerminal } from "@xterm/headless";
import { describe, expect, it } from "vitest";

import { XtermHeadlessLoader } from "../../src/services/xterm-headless-loader.ts";

describe("XtermHeadlessLoader", () => {
  it("creates a headless terminal that parses what is written to it", async () => {
    const terminal: XtermTerminal = XtermHeadlessLoader.createTerminal({ allowProposedApi: true, cols: 20, rows: 2 });

    await new Promise<void>(t => terminal.write("Hello\r\nworld", t));

    expect(terminal.buffer.active.getLine(0)?.translateToString(true)).toBe("Hello");
    expect(terminal.buffer.active.getLine(1)?.translateToString(true)).toBe("world");
    terminal.dispose();
  });

  it("is needed while the published manifest names a missing ES module entry", () => {
    const manifestPath: string = createRequire(import.meta.url).resolve("@xterm/headless/package.json");
    const manifest: { readonly module?: unknown } = JSON.parse(readFileSync(manifestPath, "utf8"));

    expect(typeof manifest.module).toBe("string");
    expect(
      existsSync(join(dirname(manifestPath), String(manifest.module))),
      "@xterm/headless now ships the ES module entry its manifest names: import it directly and remove src/services/xterm-headless-loader.ts."
    ).toBe(false);
  });
});
