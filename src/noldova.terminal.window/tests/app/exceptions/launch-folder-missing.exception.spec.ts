/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import { LaunchFolderMissingException } from "../../../src/app/exceptions/launch-folder-missing.exception.ts";
import { TerminalLaunchRefusedException } from "../../../src/app/exceptions/terminal-launch-refused.exception.ts";

describe("LaunchFolderMissingException", () => {
  it("says nothing opened and names the missing folder, as a launch refusal of the folder", () => {
    const error: LaunchFolderMissingException = new LaunchFolderMissingException("/gone");

    expect(error).toBeInstanceOf(TerminalLaunchRefusedException);
    expect([error.name, error.message, error.parameter, error.folder]).toEqual(["LaunchFolderMissingException",
      "The terminal wasn't launched, and nothing opened: folder /gone doesn't exist.", "folder", "/gone"]);
  });
});
