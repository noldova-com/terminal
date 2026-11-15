/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import { LaunchRowsRefusedException } from "../../../src/app/exceptions/launch-rows-refused.exception.ts";
import { TerminalLaunchRefusedException } from "../../../src/app/exceptions/terminal-launch-refused.exception.ts";

describe("LaunchRowsRefusedException", () => {
  it("says nothing opened and gives the rows' range, as a launch refusal of the minimum rows", () => {
    const error: LaunchRowsRefusedException = new LaunchRowsRefusedException(100);

    expect(error).toBeInstanceOf(TerminalLaunchRefusedException);
    expect([error.name, error.message, error.parameter, error.maximum]).toEqual(["LaunchRowsRefusedException",
      "The terminal wasn't launched, and nothing opened: minimumRows must be a whole number from 1 to 100.", "minimumRows", 100]);
  });
});
