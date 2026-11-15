/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import { TerminalRunNotFoundException } from "../../../src/app/exceptions/terminal-run-not-found.exception.ts";
import { TerminalWindowException } from "../../../src/app/exceptions/terminal-window.exception.ts";

describe("TerminalRunNotFoundException", () => {
  it("names the terminal and the run it has no output for, as a window exception", () => {
    const error: TerminalRunNotFoundException = new TerminalRunNotFoundException("s1", "r7");

    expect(error).toBeInstanceOf(TerminalWindowException);
    expect([error.name, error.message, error.sessionId, error.runId]).toEqual(["TerminalRunNotFoundException",
      "Terminal s1 has no run r7 whose output it can give.", "s1", "r7"]);
  });
});
