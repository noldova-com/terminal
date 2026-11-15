/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import { LaunchArgumentRefusedException } from "../../../src/app/exceptions/launch-argument-refused.exception.ts";
import { LaunchFolderMissingException } from "../../../src/app/exceptions/launch-folder-missing.exception.ts";
import { LaunchPartInactiveException } from "../../../src/app/exceptions/launch-part-inactive.exception.ts";
import { LaunchRowsRefusedException } from "../../../src/app/exceptions/launch-rows-refused.exception.ts";
import { LaunchRowsWithoutTabException } from "../../../src/app/exceptions/launch-rows-without-tab.exception.ts";
import { LaunchTitleRefusedException } from "../../../src/app/exceptions/launch-title-refused.exception.ts";
import { TerminalLaunchRefusedException } from "../../../src/app/exceptions/terminal-launch-refused.exception.ts";
import { TerminalWindowException } from "../../../src/app/exceptions/terminal-window.exception.ts";

describe("TerminalLaunchRefusedException", () => {
  it("is the window exception every launch refusal extends, each saying nothing opened and naming its field", () => {
    const errors: readonly TerminalLaunchRefusedException[] = [
      new LaunchPartInactiveException(),
      new LaunchFolderMissingException("/gone"),
      new LaunchTitleRefusedException(200),
      new LaunchRowsRefusedException(100),
      new LaunchRowsWithoutTabException(),
      new LaunchArgumentRefusedException("environment.TERM", "Expected a string that is not blank.")
    ];

    expect(errors.map(t => t instanceof TerminalWindowException)).toEqual(errors.map(() => true));
    expect(errors.filter(t => !t.message.startsWith("The terminal wasn't launched, and nothing opened: ")).map(t => t.name)).toEqual([]);
    expect(errors.map(t => t.parameter)).toEqual(["context", "folder", "title", "minimumRows", "minimumRows", "environment.TERM"]);
  });
});
