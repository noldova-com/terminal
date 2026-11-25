/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import { Terminal, type IMarker } from "@xterm/xterm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { CommandContinuation } from "../../../src/app/models/command-continuation.ts";

describe("CommandContinuation", () => {
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

  it("holds the marker of the line a command continues on and the column its text starts at", () => {
    const marker: IMarker | undefined = terminal.registerMarker(0);
    expect(marker).toBeDefined();
    if (Object.isUndefined(marker))
      return;

    const continuation: CommandContinuation = new CommandContinuation(marker, 2);

    expect([continuation.marker, continuation.column]).toEqual([marker, 2]);
  });
});
