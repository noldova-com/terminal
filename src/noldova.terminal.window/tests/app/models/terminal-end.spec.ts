/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import { TerminalEndedBy } from "../../../src/app/enums/terminal-ended-by.ts";
import { TerminalEnd } from "../../../src/app/models/terminal-end.ts";

describe("TerminalEnd", () => {
  it("holds how the terminal ended and its exit code, or none", () => {
    const ends: readonly TerminalEnd[] = [new TerminalEnd(TerminalEndedBy.Exit, 2), new TerminalEnd(TerminalEndedBy.Close, null)];

    expect(ends.map(t => [t.endedBy, t.exitCode])).toEqual([["Exit", 2], ["Close", null]]);
  });
});
