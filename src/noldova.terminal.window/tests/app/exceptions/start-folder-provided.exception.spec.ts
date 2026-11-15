/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import { StartFolderProvidedException } from "../../../src/app/exceptions/start-folder-provided.exception.ts";
import { TerminalWindowException } from "../../../src/app/exceptions/terminal-window.exception.ts";

describe("StartFolderProvidedException", () => {
  it("says the window already has a start folder provider, as a window exception", () => {
    const error: StartFolderProvidedException = new StartFolderProvidedException();

    expect(error).toBeInstanceOf(TerminalWindowException);
    expect([error.name, error.message]).toEqual(["StartFolderProvidedException",
      "This window already has a start folder provider; unregister it before providing another."]);
  });
});
