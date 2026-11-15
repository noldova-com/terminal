/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TerminalShellKind } from "@noldova/terminal.protocol";
import { describe, expect, it } from "vitest";

import { TerminalTabLabel } from "../../../src/app/models/terminal-tab-label.ts";

describe("TerminalTabLabel", () => {
  it("holds its name and its shell's name and kind, or no names", () => {
    const named: TerminalTabLabel = new TerminalTabLabel("Server", "Bash", TerminalShellKind.Bash);
    const plain: TerminalTabLabel = new TerminalTabLabel(null, null, TerminalShellKind.Other);

    expect([named.name, named.shellName, named.shellKind, plain.name, plain.shellName, plain.shellKind])
      .toEqual(["Server", "Bash", TerminalShellKind.Bash, null, null, TerminalShellKind.Other]);
  });
});
