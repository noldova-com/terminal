/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TerminalRunBusy } from "@noldova/terminal.protocol";
import { describe, expect, it } from "vitest";

import { TerminalRunTarget } from "../../../src/app/models/terminal-run-target.ts";

describe("TerminalRunTarget", () => {
  it("holds its terminal and refuses a busy one unless told to interrupt it", () => {
    const targets: readonly TerminalRunTarget[] = [new TerminalRunTarget("s1"), new TerminalRunTarget("s2", TerminalRunBusy.Interrupt)];

    expect(targets.map(t => [t.sessionId, t.whenBusy])).toEqual([["s1", "Refuse"], ["s2", "Interrupt"]]);
  });
});
