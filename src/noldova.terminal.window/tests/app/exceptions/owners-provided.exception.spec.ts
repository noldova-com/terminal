/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import { OwnersProvidedException } from "../../../src/app/exceptions/owners-provided.exception.ts";
import { TerminalWindowException } from "../../../src/app/exceptions/terminal-window.exception.ts";

describe("OwnersProvidedException", () => {
  it("says the window already has an owners provider, as a window exception", () => {
    const error: OwnersProvidedException = new OwnersProvidedException();

    expect(error).toBeInstanceOf(TerminalWindowException);
    expect([error.name, error.message]).toEqual(["OwnersProvidedException",
      "This window already has an owners provider; remove it before providing another."]);
  });
});
