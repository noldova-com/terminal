/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import { LaunchRowsWithoutTabException } from "../../../src/app/exceptions/launch-rows-without-tab.exception.ts";
import { TerminalLaunchRefusedException } from "../../../src/app/exceptions/terminal-launch-refused.exception.ts";

describe("LaunchRowsWithoutTabException", () => {
  it("says nothing opened since minimum rows need the launch's tab, as a launch refusal of the minimum rows", () => {
    const error: LaunchRowsWithoutTabException = new LaunchRowsWithoutTabException();

    expect(error).toBeInstanceOf(TerminalLaunchRefusedException);
    expect([error.name, error.message, error.parameter]).toEqual(["LaunchRowsWithoutTabException",
      "The terminal wasn't launched, and nothing opened: minimumRows needs the launch's tab; an embedded terminal takes its rows from EmbeddedTerminal.open.", "minimumRows"]);
  });
});
