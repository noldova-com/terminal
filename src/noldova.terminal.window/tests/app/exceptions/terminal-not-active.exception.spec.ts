/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import { TerminalNotActiveException } from "../../../src/app/exceptions/terminal-not-active.exception.ts";
import { TerminalWindowException } from "../../../src/app/exceptions/terminal-window.exception.ts";

describe("TerminalNotActiveException", () => {
  it("says the terminal isn't active in the window, as a window exception", () => {
    const error: TerminalNotActiveException = new TerminalNotActiveException();

    expect(error).toBeInstanceOf(TerminalWindowException);
    expect([error.name, error.message]).toEqual(["TerminalNotActiveException", "Terminal isn't active in this window."]);
  });
});
