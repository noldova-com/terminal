/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import { EmbeddedRowsRefusedException } from "../../../src/app/exceptions/embedded-rows-refused.exception.ts";
import { TerminalWindowException } from "../../../src/app/exceptions/terminal-window.exception.ts";

describe("EmbeddedRowsRefusedException", () => {
  it("gives the range of rows an embedded terminal takes and the rows asked for, as a window exception", () => {
    const error: EmbeddedRowsRefusedException = new EmbeddedRowsRefusedException(0, 1, 1000);

    expect(error).toBeInstanceOf(TerminalWindowException);
    expect([error.name, error.message, error.rows, error.minimum, error.maximum]).toEqual(["EmbeddedRowsRefusedException",
      "An embedded terminal's rows must be a whole number from 1 to 1000, not 0.", 0, 1, 1000]);
  });
});
