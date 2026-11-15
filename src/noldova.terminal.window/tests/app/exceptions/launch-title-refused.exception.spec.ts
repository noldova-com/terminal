/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import { LaunchTitleRefusedException } from "../../../src/app/exceptions/launch-title-refused.exception.ts";
import { TerminalLaunchRefusedException } from "../../../src/app/exceptions/terminal-launch-refused.exception.ts";

describe("LaunchTitleRefusedException", () => {
  it("says nothing opened and gives the title's rule, as a launch refusal of the title", () => {
    const error: LaunchTitleRefusedException = new LaunchTitleRefusedException(200);

    expect(error).toBeInstanceOf(TerminalLaunchRefusedException);
    expect([error.name, error.message, error.parameter, error.maximumLength]).toEqual(["LaunchTitleRefusedException",
      "The terminal wasn't launched, and nothing opened: title must not be blank and must have at most 200 characters.", "title", 200]);
  });
});
