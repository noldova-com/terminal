/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TerminalRunOutcome } from "@noldova/terminal.protocol";
import { describe, expect, it } from "vitest";

import { TerminalRunNotTypedException } from "../../../src/app/exceptions/terminal-run-not-typed.exception.ts";
import { TerminalWindowException } from "../../../src/app/exceptions/terminal-window.exception.ts";

describe("TerminalRunNotTypedException", () => {
  it("names the terminal and its outcome, as a window exception", () => {
    const error: TerminalRunNotTypedException = new TerminalRunNotTypedException("s1", TerminalRunOutcome.Tab);

    expect(error).toBeInstanceOf(TerminalWindowException);
    expect([error.name, error.sessionId, error.reason]).toEqual(["TerminalRunNotTypedException", "s1", TerminalRunOutcome.Tab]);
  });

  it("says why the commands weren't typed, for each outcome", () => {
    const outcomes: readonly TerminalRunOutcome[] = [TerminalRunOutcome.Typed, TerminalRunOutcome.Input, TerminalRunOutcome.Tab,
      TerminalRunOutcome.Ended, TerminalRunOutcome.Busy, TerminalRunOutcome.NoShell];

    expect(outcomes.map(t => new TerminalRunNotTypedException("s2", t).message)).toEqual([
      "The commands weren't typed into terminal s2: they were typed.",
      "The commands weren't typed into terminal s2: the person typed in it, or its prompt line held text, before they went in.",
      "The commands weren't typed into terminal s2: they hold a tab, which its shell would take as completion.",
      "The commands weren't typed into terminal s2: it ended, closed or restarted first.",
      "The commands weren't typed into terminal s2: its shell was busy, running a command or with text on its prompt line, and stayed so.",
      "The commands weren't typed into terminal s2: no shell of the run's kinds is installed."
    ]);
  });
});
