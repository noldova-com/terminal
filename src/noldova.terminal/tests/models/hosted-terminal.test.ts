/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import assert from "node:assert/strict";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { Resources as ProtocolResources, TerminalShellKind, TerminalSize } from "@noldova/terminal.protocol";
import { describe, it } from "vitest";

import { HostedTerminal } from "../../src/models/hosted-terminal.ts";
import type { MirrorLine } from "../../src/models/mirror-line.ts";
import { Shell } from "../../src/models/shell.ts";
import { TerminalHistoryPaths } from "../../src/models/terminal-history-paths.ts";
import { Resources } from "../../src/resources.ts";
import { TerminalSession } from "../../src/services/terminal-session.ts";
import { FakePtyProcess } from "../fixtures/fake-pty-process.fixture.ts";
import { SessionRecorder } from "../fixtures/session-recorder.fixture.ts";

describe("HostedTerminal", () => {
  it("keeps its latest 100 runs, oldest first, forgetting the oldest and disposing its start's line, and every run's when it clears them", async () => {
    const session: TerminalSession = new TerminalSession("s1", "bash", new TerminalSize(80, 24), new FakePtyProcess(), "n1", null,
      new TerminalHistoryPaths(join(tmpdir(), "hosted-terminal-none", "s1-1.jsonl"), join(tmpdir(), "hosted-terminal-none", "s1-2.jsonl")), ProtocolResources.defaultStoredLimit,
      new SessionRecorder(), Resources.maximumAgentTextLength, TerminalShellKind.Other, false);
    const terminal: HostedTerminal = new HostedTerminal(session, new Shell("bash", "Bash", TerminalShellKind.Bash, "/bin/bash", [], false),
      "/work", null, false, "example.chat/42", 1);

    const starts: Promise<MirrorLine>[] = Array.from({ length: 101 }, () => session.anchorRunAsync());
    starts.forEach((t, index) => terminal.addRun(`run-${index}`, t));
    const lines: readonly MirrorLine[] = await Promise.all(starts);
    const kept: readonly unknown[] = [terminal.runs.size, [...terminal.runs.keys()].at(0), [...terminal.runs.keys()].at(-1), lines.slice(0, 2).map(t => t.index)];
    terminal.clearRuns();
    await Promise.all(starts);

    assert.deepEqual(kept, [100, "run-1", "run-100", [null, 0]]);
    assert.deepEqual([terminal.runs.size, lines.filter(t => !Object.isNull(t.index)).length], [0, 0]);
    await session.disposeAsync();
  });

  it("forgets a run whose start failed, observing the failure rather than leaving it unhandled", async () => {
    const session: TerminalSession = new TerminalSession("s1", "bash", new TerminalSize(80, 24), new FakePtyProcess(), "n1", null, null,
      ProtocolResources.defaultStoredLimit, new SessionRecorder(), Resources.maximumAgentTextLength, TerminalShellKind.Other, false);
    const terminal: HostedTerminal = new HostedTerminal(session, new Shell("bash", "Bash", TerminalShellKind.Bash, "/bin/bash", [], false),
      "/work", null, false, "example.chat/42", 1);
    const start: Promise<MirrorLine> = Promise.reject(new Error("start failed"));

    terminal.addRun("run-0", start);
    terminal.clearRuns();
    await assert.rejects(start, { message: "start failed" });

    assert.equal(terminal.runs.size, 0);
    await session.disposeAsync();
  });

  it("stops the command it is typing and the interrupt it is waiting to send when its command is cancelled", async () => {
    const session: TerminalSession = new TerminalSession("s1", "bash", new TerminalSize(80, 24), new FakePtyProcess(), "n1", null, null,
      ProtocolResources.defaultStoredLimit, new SessionRecorder(), Resources.maximumAgentTextLength, TerminalShellKind.Other, false);
    const terminal: HostedTerminal = new HostedTerminal(session, new Shell("bash", "Bash", TerminalShellKind.Bash, "/bin/bash", [], false),
      "/work", null, false, "example.chat/42", 1);
    const command: AbortController = new AbortController();
    terminal.pendingCommand = command;
    const interrupt: AbortSignal = terminal.beginInterrupt();

    terminal.cancelCommand();
    const next: AbortSignal = terminal.beginInterrupt();
    terminal.endInterrupt();
    terminal.cancelCommand();

    assert.deepEqual([command.signal.aborted, interrupt.aborted, terminal.pendingCommand, next.aborted], [true, true, null, false]);
    await session.disposeAsync();
  });
});
