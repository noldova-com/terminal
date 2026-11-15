/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import type { IMarker, Terminal as XtermTerminal } from "@xterm/headless";
import { afterEach, beforeEach, describe, it } from "vitest";

import { MirrorLine } from "../../src/models/mirror-line.ts";
import { XtermHeadlessLoader } from "../../src/services/xterm-headless-loader.ts";

describe("MirrorLine", () => {
  let terminal: XtermTerminal;

  beforeEach(async () => {
    terminal = XtermHeadlessLoader.createTerminal({ allowProposedApi: true, cols: 20, rows: 5 });
    await new Promise<void>(t => terminal.write("one\r\ntwo\r\nthree", t));
  });

  afterEach(() => {
    terminal.dispose();
  });

  it("holds its number and has no index without a marker", () => {
    const line: MirrorLine = new MirrorLine(7, undefined);

    assert.equal(line.number, 7);
    assert.equal(line.index, null);
  });

  it("takes a new number when renumbered", () => {
    const line: MirrorLine = new MirrorLine(7, undefined);

    line.renumber(3);

    assert.equal(line.number, 3);
  });

  it("reads its index from the marker's buffer line", () => {
    const marker: IMarker | undefined = terminal.registerMarker(0);
    const line: MirrorLine = new MirrorLine(1, marker);

    assert.notEqual(marker, undefined);
    assert.equal(line.index, 2);
  });

  it("disposes its marker and then has no index", () => {
    const marker: IMarker | undefined = terminal.registerMarker(-1);
    const line: MirrorLine = new MirrorLine(1, marker);

    assert.equal(line.index, 1);

    line.dispose();

    assert.equal(marker?.isDisposed, true);
    assert.equal(line.index, null);
  });

  it("disposes without a marker", () => {
    const line: MirrorLine = new MirrorLine(1, undefined);

    line.dispose();

    assert.equal(line.index, null);
  });
});
