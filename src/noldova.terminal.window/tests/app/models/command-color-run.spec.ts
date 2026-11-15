/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Terminal, type IMarker } from "@xterm/xterm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { CommandTokenKind } from "../../../src/app/enums/command-token-kind.ts";
import { CommandColorRun } from "../../../src/app/models/command-color-run.ts";

describe("CommandColorRun", () => {
  let host: HTMLElement;
  let terminal: Terminal;

  beforeEach(() => {
    host = document.createElement("div");
    document.body.append(host);
    terminal = new Terminal({ cols: 40, rows: 5, allowProposedApi: true });
    terminal.open(host);
  });

  afterEach(() => {
    terminal.dispose();
    host.remove();
  });

  it("holds its marker, place, kind and text, and no decoration until one is drawn", () => {
    const marker: IMarker | undefined = terminal.registerMarker(0);
    expect(marker).toBeDefined();
    if (marker === undefined)
      return;

    const run: CommandColorRun = new CommandColorRun(marker, 2, 4, CommandTokenKind.Command, "echo");

    expect(run.marker).toBe(marker);
    expect([run.x, run.width, run.kind, run.text, run.decoration]).toEqual([2, 4, "Command", "echo", undefined]);
  });
});
