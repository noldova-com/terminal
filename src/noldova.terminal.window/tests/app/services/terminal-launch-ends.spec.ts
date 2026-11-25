/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { afterEach, describe, expect, it } from "vitest";

import { TerminalEndedBy } from "../../../src/app/enums/terminal-ended-by.ts";
import { TerminalEnd } from "../../../src/app/models/terminal-end.ts";
import { TerminalLaunchEnds } from "../../../src/app/services/terminal-launch-ends.ts";

class SessionEnd {
  public readonly sessionId: string;
  public readonly end: TerminalEnd;

  public constructor(sessionId: string, end: TerminalEnd) {
    this.sessionId = sessionId;
    this.end = end;
  }
}

describe("TerminalLaunchEnds", () => {
  const added: string[] = [];

  afterEach(() => {
    for (const sessionId of added.splice(0))
      TerminalLaunchEnds.remove(sessionId);
  });

  function add(sessionId: string, ends: SessionEnd[]): void {
    added.push(sessionId);
    TerminalLaunchEnds.add(sessionId, t => ends.push(new SessionEnd(sessionId, t)));
  }

  it("ends every launched terminal still waiting as detached, each once its finish runs", () => {
    const ends: SessionEnd[] = [];
    add("ends-1", ends);
    add("ends-2", ends);

    TerminalLaunchEnds.detachAll();

    expect(ends).toEqual([new SessionEnd("ends-1", new TerminalEnd(TerminalEndedBy.Detach, null)), new SessionEnd("ends-2", new TerminalEnd(TerminalEndedBy.Detach, null))]);
  });

  it("leaves out a launched terminal removed before, and one added again keeps only its latest finish", () => {
    const ends: SessionEnd[] = [];
    add("ends-1", ends);
    add("ends-2", []);
    add("ends-2", ends);
    TerminalLaunchEnds.remove("ends-1");

    TerminalLaunchEnds.detachAll();

    expect(ends).toEqual([new SessionEnd("ends-2", new TerminalEnd(TerminalEndedBy.Detach, null))]);
  });
});
