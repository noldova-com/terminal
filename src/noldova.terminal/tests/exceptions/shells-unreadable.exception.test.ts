/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { ShellsUnreadableException } from "../../src/exceptions/shells-unreadable.exception.ts";
import { TerminalException } from "../../src/exceptions/terminal.exception.ts";
import { VisualStudioUnreadableException } from "../../src/exceptions/visual-studio-unreadable.exception.ts";
import { WslDistributionsUnreadableException } from "../../src/exceptions/wsl-distributions-unreadable.exception.ts";

describe("ShellsUnreadableException", () => {
  it("is the base of every shell list that could not be read, as a TerminalException", () => {
    const errors: readonly Error[] = [new VisualStudioUnreadableException(), new WslDistributionsUnreadableException()];

    assert.deepEqual(errors.filter(t => !(t instanceof ShellsUnreadableException && t instanceof TerminalException)).map(t => t.name), []);
  });
});
