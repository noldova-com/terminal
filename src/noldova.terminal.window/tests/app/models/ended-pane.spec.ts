/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TerminalSize } from "@noldova/terminal.protocol";
import { Terminal } from "@xterm/xterm";
import { afterEach, describe, expect, it } from "vitest";

import { EndedPane } from "../../../src/app/models/ended-pane.ts";

describe("EndedPane", () => {
  let terminal: Terminal;

  afterEach(() => {
    terminal.dispose();
  });

  it("holds its text and gives the terminal's size as it is when asked", () => {
    terminal = new Terminal({ cols: 90, rows: 30 });
    const pane: EndedPane = new EndedPane("The shell exited with code 2.", terminal);

    expect([pane.text, pane.size]).toEqual(["The shell exited with code 2.", new TerminalSize(90, 30)]);
    terminal.resize(60, 12);
    expect(pane.size).toEqual(new TerminalSize(60, 12));
  });
});
