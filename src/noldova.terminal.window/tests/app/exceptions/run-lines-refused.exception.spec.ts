/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import { RunLinesRefusedException } from "../../../src/app/exceptions/run-lines-refused.exception.ts";
import { TerminalWindowException } from "../../../src/app/exceptions/terminal-window.exception.ts";

describe("RunLinesRefusedException", () => {
  it("gives the range of lines a read takes and the number asked for, as a window exception", () => {
    const error: RunLinesRefusedException = new RunLinesRefusedException(0, 10000);

    expect(error).toBeInstanceOf(TerminalWindowException);
    expect([error.name, error.message, error.lines, error.maximum]).toEqual(["RunLinesRefusedException",
      "A run's output can be read up to a whole number from 1 to 10000 of lines, not 0.", 0, 10000]);
  });
});
