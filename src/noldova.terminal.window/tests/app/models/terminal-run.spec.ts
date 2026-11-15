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
import { TerminalRun } from "../../../src/app/models/terminal-run.ts";

describe("TerminalRun", () => {
  it("holds its terminal, its id and its end", async () => {
    const ended: Promise<TerminalRunEnd> = Promise.resolve(new TerminalRunEnd(TerminalRunEndedBy.Command, 3));
    const run: TerminalRun = new TerminalRun("s1", "r1", ended);

    expect([run.sessionId, run.runId]).toEqual(["s1", "r1"]);
    expect(run.ended).toBe(ended);
    expect(await run.ended).toEqual(new TerminalRunEnd(TerminalRunEndedBy.Command, 3));
  });

  it("ends with its terminal, without an exit code, when given no end", async () => {
    expect(await new TerminalRun("s1", "r1").ended).toEqual(new TerminalRunEnd(TerminalRunEndedBy.TerminalEnded, null));
  });
});
