/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import { LaunchArgumentRefusedException } from "../../../src/app/exceptions/launch-argument-refused.exception.ts";
import { TerminalLaunchRefusedException } from "../../../src/app/exceptions/terminal-launch-refused.exception.ts";

describe("LaunchArgumentRefusedException", () => {
  it("says nothing opened and why, and names the refused field, as a launch refusal", () => {
    const error: LaunchArgumentRefusedException = new LaunchArgumentRefusedException("folder", "Expected an absolute path.");

    expect(error).toBeInstanceOf(TerminalLaunchRefusedException);
    expect([error.name, error.message, error.parameter, error.reason]).toEqual(["LaunchArgumentRefusedException",
      "The terminal wasn't launched, and nothing opened: Expected an absolute path.", "folder", "Expected an absolute path."]);
  });
});
