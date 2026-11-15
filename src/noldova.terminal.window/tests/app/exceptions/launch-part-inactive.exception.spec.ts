/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import { LaunchPartInactiveException } from "../../../src/app/exceptions/launch-part-inactive.exception.ts";
import { TerminalLaunchRefusedException } from "../../../src/app/exceptions/terminal-launch-refused.exception.ts";

describe("LaunchPartInactiveException", () => {
  it("says nothing opened since the window part isn't active, as a launch refusal of the context", () => {
    const error: LaunchPartInactiveException = new LaunchPartInactiveException();

    expect(error).toBeInstanceOf(TerminalLaunchRefusedException);
    expect([error.name, error.message, error.parameter]).toEqual(["LaunchPartInactiveException",
      "The terminal wasn't launched, and nothing opened: the terminal's window part isn't active in this window.", "context"]);
  });
});
