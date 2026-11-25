/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TerminalTextStyle } from "@noldova/terminal.protocol";
import { describe, expect, it } from "vitest";

import { StyleParameter } from "../../../src/app/models/style-parameter.ts";

describe("StyleParameter", () => {
  it("holds a text style and the SGR parameter that sets it", () => {
    const parameter: StyleParameter = new StyleParameter(TerminalTextStyle.Underline, 4);

    expect(parameter.style).toBe(TerminalTextStyle.Underline);
    expect(parameter.parameter).toBe(4);
  });
});
