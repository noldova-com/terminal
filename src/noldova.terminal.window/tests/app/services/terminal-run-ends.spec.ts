/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TerminalRunEnded, TerminalRunEndedBy } from "@noldova/terminal.protocol";
import { afterEach, describe, expect, it } from "vitest";

import { TerminalRun } from "../../../src/app/models/terminal-run.ts";
import { TerminalRunEnd } from "../../../src/app/models/terminal-run-end.ts";
import { TerminalRunEnds } from "../../../src/app/services/terminal-run-ends.ts";

describe("TerminalRunEnds", () => {
  afterEach(() => TerminalRunEnds.detachAll());

  function end(runId: string, exitCode: number): void {
    TerminalRunEnds.end(new TerminalRunEnded("s1", runId, TerminalRunEndedBy.Command, exitCode));
  }

  it("keeps the latest 64 ends that came before their runs asked, and gives each once", async () => {
    for (let index: number = 0; index <= 64; index++)
      end(`run-${index}`, index);

    const kept: TerminalRunEnd = await TerminalRunEnds.waitAsync("run-64");
    const oldest: TerminalRunEnd | string = await Promise.race([TerminalRunEnds.waitAsync("run-0"), Promise.resolve("waiting")]);
    const again: TerminalRunEnd | string = await Promise.race([TerminalRunEnds.waitAsync("run-64"), Promise.resolve("waiting")]);

    expect([kept, oldest, again]).toEqual([new TerminalRunEnd("Command", 64), "waiting", "waiting"]);
  });

  it("forgets the ends that came early once the runtime starts again, since their runs ended with it", async () => {
    end("run-1", 0);
    TerminalRunEnds.detachAll();

    expect(await Promise.race([TerminalRunEnds.waitAsync("run-1"), Promise.resolve("waiting")])).toBe("waiting");
  });

  it("gives a run made without its end TerminalEnded at once, since nothing tells it", async () => {
    expect(await new TerminalRun("s1", "r1").ended).toEqual(new TerminalRunEnd("TerminalEnded", null));
  });
});
