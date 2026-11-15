/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import { TerminalEndedBy } from "../../../src/app/enums/terminal-ended-by.ts";
import { LaunchedTerminal } from "../../../src/app/models/launched-terminal.ts";
import { TerminalEnd } from "../../../src/app/models/terminal-end.ts";

describe("LaunchedTerminal", () => {
  class HeldEnd {
    public resolve: (value: TerminalEnd) => void = () => undefined;
    public readonly promise: Promise<TerminalEnd> = new Promise<TerminalEnd>(resolve => {
      this.resolve = resolve;
    });
  }

  it("holds its terminal and its end, and gives its command no exit code once it ends when given no command end", async () => {
    const end: HeldEnd = new HeldEnd();
    const launched: LaunchedTerminal = new LaunchedTerminal("s1", end.promise);

    expect(launched.sessionId).toBe("s1");
    expect(launched.ended).toBe(end.promise);
    end.resolve(new TerminalEnd(TerminalEndedBy.Exit, 4));
    expect([await launched.ended, await launched.commandEnded]).toEqual([new TerminalEnd(TerminalEndedBy.Exit, 4), null]);
  });

  it("gives the command end it was given", async () => {
    const commandEnded: Promise<number | null> = Promise.resolve(7);
    const launched: LaunchedTerminal = new LaunchedTerminal("s1", new HeldEnd().promise, () => Promise.resolve(), commandEnded);

    expect(launched.commandEnded).toBe(commandEnded);
    expect(await launched.commandEnded).toBe(7);
  });

  it("closes its tab once while the terminal runs, however often it is asked", async () => {
    let closes: number = 0;
    const launched: LaunchedTerminal = new LaunchedTerminal("s1", new HeldEnd().promise, async () => {
      closes += 1;
    });

    const first: Promise<void> = launched.closeAsync();
    const second: Promise<void> = launched.closeAsync();
    await first;
    const third: Promise<void> = launched.closeAsync();
    await third;

    expect(second).toBe(first);
    expect(third).toBe(first);
    expect(closes).toBe(1);
  });

  it("closes no tab once the terminal ended", async () => {
    const end: HeldEnd = new HeldEnd();
    let closes: number = 0;
    const launched: LaunchedTerminal = new LaunchedTerminal("s1", end.promise, async () => {
      closes += 1;
    });
    end.resolve(new TerminalEnd(TerminalEndedBy.Close, null));
    await launched.ended;

    await launched.closeAsync();

    expect(closes).toBe(0);
  });

  it("closes without a tab to close when given none", async () => {
    await expect(new LaunchedTerminal("s1", new HeldEnd().promise).closeAsync()).resolves.toBeUndefined();
  });
});
