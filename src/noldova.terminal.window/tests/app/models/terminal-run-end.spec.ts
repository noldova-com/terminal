/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TerminalRunEndedBy } from "@noldova/terminal.protocol";
import { describe, expect, it } from "vitest";

import { TerminalRunEnd } from "../../../src/app/models/terminal-run-end.ts";

describe("TerminalRunEnd", () => {
  it("holds how the run ended and its exit code, or none", () => {
    const ends: readonly TerminalRunEnd[] = [new TerminalRunEnd(TerminalRunEndedBy.Command, 0),
      new TerminalRunEnd(TerminalRunEndedBy.NoIntegration, null)];

    expect(ends.map(t => [t.endedBy, t.exitCode])).toEqual([["Command", 0], ["NoIntegration", null]]);
  });
});
