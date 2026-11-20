/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { FailureCode } from "@noldova/desktop.protocol";
import type { JsonValue } from "@noldova/context.json";
import { EndedBy, TerminalExit, TerminalLine, TerminalLineRange, TerminalNames, TerminalSize, TerminalTextRun, WindowsPty, type TerminalAttachment, TerminalInputEdge, TerminalInputMark, type TerminalLinePage } from "@noldova/terminal.protocol";
import { afterEach, describe, expect, it, onTestFinished, vi } from "vitest";

import type { ITerminalSink } from "../../../src/app/interfaces/i-terminal-sink.ts";
import { TerminalConnection } from "../../../src/app/services/terminal-connection.ts";
import { FakeRuntime } from "../../fixtures/fake-runtime.fixture.ts";
import { SpecWait } from "../../fixtures/spec-wait.fixture.ts";
import type { TerminalPartContext } from "../../fixtures/terminal-part-context.fixture.ts";

class SinkRecorder implements ITerminalSink {
  public readonly events: string[] = [];
  public readonly callbacks: (() => void)[] = [];
  public readonly followed: TerminalLineRange[] = [];

  public drawn: Promise<void> = Promise.resolve();
  public drawFailure: Error | null = null;

  public async drawAsync(attachment: TerminalAttachment): Promise<void> {
    const { size, windowsPty } = attachment;
    this.events.push(`reset ${size.columns}x${size.rows} ${windowsPty === null ? "none" : windowsPty.buildNumber}`);
    await this.drawn;
    if (this.drawFailure !== null)
      throw this.drawFailure;
    this.events.push(`write ${attachment.snapshot + attachment.pending}`);
  }

  public markInput(edge: TerminalInputEdge): void {
    this.events.push(`input ${edge}`);
  }

  public addCommand(command: string): void {
    this.events.push(`command ${command}`);
  }

  public follow(stored: TerminalLineRange): void {
    this.followed.push(stored);
  }

  public write(data: string, written: () => void): void {
    this.events.push(`write ${data}`);
    this.callbacks.push(written);
  }

  public showTitle(title: string): void {
    this.events.push(`title ${title}`);
  }

  public showCwd(cwd: string): void {
    this.events.push(`cwd ${cwd}`);
  }

  public showExit(exit: TerminalExit): void {
    this.events.push(`exit ${exit.exitCode}`);
  }

  public showRunning(): void {
    this.events.push("running");
  }

  public showLost(): void {
    this.events.push("lost");
  }
}

class GoneRefusal extends Error {
  public readonly code: string = FailureCode.NotFound;
}

class ConnectionHarness {
  public readonly runtime: FakeRuntime = new FakeRuntime();
  public readonly sink: SinkRecorder = new SinkRecorder();
  public readonly connection: TerminalConnection = new TerminalConnection(this.runtime.context, "s1", "p1", this.sink);

  public sent(method: string): readonly unknown[] {
    return this.runtime.context.sent(method);
  }

  public async openAsync(isVisible: boolean = true): Promise<void> {
    const opening: Promise<void> = this.connection.openAsync();
    this.connection.setVisible(isVisible);
    await opening;
  }
}

function answersOf(harness: ConnectionHarness): Promise<unknown>[] {
  const answers: Promise<unknown>[] = [];
  const context: TerminalPartContext = harness.runtime.context;
  const request: (method: string, parameters: JsonValue) => Promise<JsonValue> = context.requestAsync.bind(context);
  vi.spyOn(context, "requestAsync").mockImplementation((method: string, parameters: JsonValue) => {
    const answer: Promise<JsonValue> = request(method, parameters);
    answers.push(answer);
    return answer;
  });
  return answers;
}


describe("TerminalConnection", () => {
  const harnesses: ConnectionHarness[] = [];

  function createHarness(): ConnectionHarness {
    const harness: ConnectionHarness = new ConnectionHarness();
    harnesses.push(harness);
    return harness;
  }

  afterEach(() => {
    for (const harness of harnesses.splice(0))
      harness.connection.close();
  });

  it("attaches with the snapshot, its pending tail, the title, the working folder and the exit, then reports whether it is shown", async () => {
    const harness: ConnectionHarness = createHarness();
    Object.assign(harness.runtime, {
      snapshot: "$ ls\r\n",
      pending: "\u001b[",
      offset: 8,
      size: new TerminalSize(100, 30),
      title: "bash",
      cwd: "/work",
      exit: new TerminalExit(2, EndedBy.Exit),
      windowsPty: new WindowsPty(19_045)
    });

    await harness.openAsync();

    expect(harness.sink.events).toEqual(["reset 100x30 19045", "write $ ls\r\n\u001b[", "title bash", "cwd /work", "exit 2"]);
    expect(harness.sent(TerminalNames.attachMethod)).toEqual([{ sessionId: "s1", paneId: "p1" }]);
    expect(harness.sent(TerminalNames.visibilityMethod)).toEqual([{ sessionId: "s1", paneId: "p1", visible: true }]);
  });

  it("writes output from the attached offset on and acknowledges each batch once written", async () => {
    const harness: ConnectionHarness = createHarness();
    harness.runtime.offset = 5;
    await harness.openAsync();

    harness.runtime.output("s1", 5, "abc");
    harness.runtime.output("s1", 8, "de");
    harness.sink.callbacks[0]?.();

    expect(harness.sink.events.slice(-2)).toEqual(["write abc", "write de"]);
    await vi.waitFor(() => expect(harness.sent(TerminalNames.ackMethod)).toEqual([{ sessionId: "s1", paneId: "p1", offset: 8 }]), { timeout: SpecWait.milliseconds });
  });

  it("writes output in parts at the shell's line's edges, and marks each edge once the part before it is written", async () => {
    const harness: ConnectionHarness = createHarness();
    harness.runtime.offset = 5;
    await harness.openAsync();

    harness.runtime.output("s1", 3, "xx$ ls", [new TerminalInputMark(5, TerminalInputEdge.End), new TerminalInputMark(7, TerminalInputEdge.Start)]);
    harness.runtime.output("s1", 9, "\r\nout", [new TerminalInputMark(11, TerminalInputEdge.End), new TerminalInputMark(14, TerminalInputEdge.Start)]);
    for (const callback of harness.sink.callbacks)
      callback();

    expect(harness.sink.events.slice(3)).toEqual(["write $ ", "write ls", "write \r\n", "write out", "write ", "input Start", "input End", "input Start"]);
    await vi.waitFor(() => expect(harness.sent(TerminalNames.ackMethod).at(-1)).toEqual({ sessionId: "s1", paneId: "p1", offset: 14 }), { timeout: SpecWait.milliseconds });
  });

  it("gives the sink each command added to its session's shell, and those added while it attaches after the attachment's", async () => {
    const harness: ConnectionHarness = createHarness();
    harness.runtime.holdAttaches();
    const opening: Promise<void> = harness.connection.openAsync();

    harness.runtime.addCommand("s1", "make");
    harness.runtime.addCommand("s2", "ls");
    harness.runtime.releaseAttaches();
    await opening;
    harness.runtime.addCommand("s1", "git status");

    expect(harness.sink.events).toEqual(["reset 80x24 none", "write ", "command make", "title ", "command git status"]);
  });

  it("keeps output that arrives before the attach, and drops the part below the snapshot's offset", async () => {
    const harness: ConnectionHarness = createHarness();
    harness.runtime.offset = 5;
    harness.runtime.holdAttaches();
    const opening: Promise<void> = harness.connection.openAsync();

    harness.runtime.output("s1", 0, "early");
    harness.runtime.output("s1", 3, "xxyyy");
    harness.runtime.releaseAttaches();
    await opening;

    expect(harness.sink.events).toEqual(["reset 80x24 none", "write ", "title ", "write yyy"]);
  });

  it("ignores another session's output, title, working folder and exit, and output it already has", async () => {
    const harness: ConnectionHarness = createHarness();
    harness.runtime.offset = 4;
    await harness.openAsync();

    harness.runtime.output("s2", 4, "other");
    harness.runtime.retitle("s2", "other");
    harness.runtime.changeCwd("s2", "/other");
    harness.runtime.exitSession("s2", 0);
    harness.runtime.output("s1", 0, "old!");

    expect(harness.sink.events).toEqual(["reset 80x24 none", "write ", "title "]);
  });

  it("shows the session's title, working folder and exit as they change", async () => {
    const harness: ConnectionHarness = createHarness();
    await harness.openAsync();

    harness.runtime.retitle("s1", "vim");
    harness.runtime.changeCwd("s1", "/work/src");
    harness.runtime.exitSession("s1", null);

    expect(harness.sink.events.slice(-3)).toEqual(["title vim", "cwd /work/src", "exit null"]);
  });

  it("shows the shell running again when the runtime restarts it, without attaching again, and ignores another session's restart", async () => {
    const harness: ConnectionHarness = createHarness();
    harness.runtime.exit = new TerminalExit(0, EndedBy.Exit);
    await harness.openAsync();

    harness.runtime.restartSession("s2");
    harness.runtime.restartSession("s1");

    expect(harness.sink.events).toEqual(["reset 80x24 none", "write ", "title ", "exit 0", "running"]);
    expect(harness.runtime.attachCount).toBe(1);
  });

  it("shows an exit that arrives while it draws its attachment once the draw ends, so the drawn screen doesn't clear it", async () => {
    const harness: ConnectionHarness = createHarness();
    let draw: () => void = () => undefined;
    harness.sink.drawn = new Promise<void>(resolve => {
      draw = resolve;
    });
    const opening: Promise<void> = harness.openAsync();
    await vi.waitFor(() => expect(harness.sink.events).toEqual(["reset 80x24 none"]), { timeout: SpecWait.milliseconds });

    harness.runtime.exitSession("s1", 0);
    draw();
    await opening;

    expect(harness.sink.events).toEqual(["reset 80x24 none", "write ", "title ", "exit 0"]);
  });

  it("shows only the shell running again after an ended session's attachment draws, for a restart that arrives while it draws, once it can size it", async () => {
    const harness: ConnectionHarness = createHarness();
    harness.runtime.exit = new TerminalExit(0, EndedBy.Exit);
    vi.spyOn(harness.sink, "showRunning").mockImplementation(() => {
      harness.sink.events.push("running");
      harness.connection.resize(new TerminalSize(100, 30));
    });
    let draw: () => void = () => undefined;
    harness.sink.drawn = new Promise<void>(resolve => {
      draw = resolve;
    });
    const opening: Promise<void> = harness.openAsync();
    await vi.waitFor(() => expect(harness.sink.events).toEqual(["reset 80x24 none"]), { timeout: SpecWait.milliseconds });

    harness.runtime.restartSession("s1");
    draw();
    await opening;

    expect(harness.sink.events).toEqual(["reset 80x24 none", "write ", "title ", "running"]);
    expect(harness.sent(TerminalNames.resizeMethod)).toEqual([{ sessionId: "s1", size: { cols: 100, rows: 30 } }]);
  });

  it("shows an exit that arrives while the attach request is under way once, though the attachment holds it too", async () => {
    const harness: ConnectionHarness = createHarness();
    harness.runtime.holdAttaches();
    const opening: Promise<void> = harness.connection.openAsync();

    harness.runtime.exit = new TerminalExit(2, EndedBy.Exit);
    harness.runtime.exitSession("s1", 2);
    harness.runtime.releaseAttaches();
    await opening;

    expect(harness.sink.events).toEqual(["reset 80x24 none", "write ", "title ", "exit 2"]);
  });

  it.each([
    [["restart", "exit"], "exit 1"],
    [["exit", "restart"], "running"]
  ])("applies only the last of an exit and a restart that arrive while it draws its attachment, %j", async (order: readonly string[], last: string) => {
    const harness: ConnectionHarness = createHarness();
    let draw: () => void = () => undefined;
    harness.sink.drawn = new Promise<void>(resolve => {
      draw = resolve;
    });
    const opening: Promise<void> = harness.openAsync();
    await vi.waitFor(() => expect(harness.sink.events).toEqual(["reset 80x24 none"]), { timeout: SpecWait.milliseconds });

    for (const change of order)
      if (change === "exit")
        harness.runtime.exitSession("s1", 1);
      else
        harness.runtime.restartSession("s1");
    draw();
    await opening;

    expect(harness.sink.events).toEqual(["reset 80x24 none", "write ", "title ", last]);
  });

  it("leaves a restart to the next attach of a pane the runtime detached", async () => {
    const harness: ConnectionHarness = createHarness();
    await harness.openAsync(false);
    harness.runtime.detach("s1", "p1");

    harness.runtime.restartSession("s1");

    expect(harness.sink.events).toEqual(["reset 80x24 none", "write ", "title "]);
  });

  it("attaches again from a snapshot when output skips ahead", async () => {
    const harness: ConnectionHarness = createHarness();
    await harness.openAsync();

    harness.runtime.output("s1", 10, "later");

    await vi.waitFor(() => expect(harness.runtime.attachCount).toBe(2), { timeout: SpecWait.milliseconds });
  });

  it("sends input typed while the attach is held at once, sizes and visibility only once attached, and nothing for empty input or an unchanged visibility", async () => {
    const harness: ConnectionHarness = createHarness();
    harness.runtime.holdAttaches();
    const opening: Promise<void> = harness.connection.openAsync();
    harness.connection.input("early");
    harness.connection.resize(new TerminalSize(90, 20));
    harness.connection.setVisible(true);
    harness.runtime.releaseAttaches();
    await opening;

    harness.connection.input("");
    harness.connection.input("ls\r");
    harness.connection.resize(new TerminalSize(120, 40));
    harness.connection.setVisible(true);
    harness.connection.setVisible(false);

    expect(harness.sent(TerminalNames.inputMethod)).toEqual(["early", "ls\r"].map(t => ({ sessionId: "s1", data: t })));
    expect(harness.sent(TerminalNames.resizeMethod)).toEqual([{ sessionId: "s1", size: { cols: 120, rows: 40 } }]);
    expect(harness.sent(TerminalNames.visibilityMethod).map(t => (t as { visible: boolean }).visible)).toEqual([true, false]);
    expect(harness.runtime.attachCount).toBe(1);
  });

  it("sends keys and a paste typed while a new pane draws its first attach at once, in order, before the keys after it", async () => {
    const harness: ConnectionHarness = createHarness();
    let draw: () => void = () => undefined;
    harness.sink.drawn = new Promise<void>(resolve => {
      draw = resolve;
    });

    const opening: Promise<void> = harness.openAsync();
    await vi.waitFor(() => expect(harness.sink.events.at(-1)).toBe("reset 80x24 none"), { timeout: SpecWait.milliseconds });
    harness.connection.input("e");
    harness.connection.input("\u001b[200~paste\u001b[201~");
    draw();
    await opening;
    harness.connection.input("\r");

    expect(harness.sent(TerminalNames.inputMethod)).toEqual(["e", "\u001b[200~paste\u001b[201~", "\r"].map(t => ({ sessionId: "s1", data: t })));
  });

  it("sends what is typed into the pane a move opens while it attaches to the same terminal, after the old pane closed", async () => {
    const harness: ConnectionHarness = createHarness();
    await harness.openAsync();
    harness.connection.close();
    const moved: TerminalConnection = new TerminalConnection(harness.runtime.context, "s1", "p2", new SinkRecorder());
    onTestFinished(() => moved.close());

    harness.runtime.holdAttaches();
    const opening: Promise<void> = moved.openAsync();
    moved.setVisible(true);
    moved.input("cd ..\r");
    harness.runtime.releaseAttaches();
    await opening;

    expect([harness.sent(TerminalNames.attachMethod).map(t => (t as { paneId: string }).paneId), harness.sent(TerminalNames.inputMethod)])
      .toEqual([["p1", "p2"], [{ sessionId: "s1", data: "cd ..\r" }]]);
  });

  it("keeps sending input and sizes while an attached pane's refresh draws, and detaches when it closes then", async () => {
    const harness: ConnectionHarness = createHarness();
    await harness.openAsync();
    let draw: () => void = () => undefined;
    harness.sink.drawn = new Promise<void>(resolve => {
      draw = resolve;
    });

    const refreshing: Promise<void> = harness.connection.refreshAsync();
    await vi.waitFor(() => expect(harness.sink.events.at(-1)).toBe("reset 80x24 none"), { timeout: SpecWait.milliseconds });
    harness.connection.input("l");
    harness.connection.input("s");
    harness.connection.resize(new TerminalSize(100, 30));
    draw();
    await refreshing;
    harness.connection.input("\r");

    expect(harness.sent(TerminalNames.inputMethod)).toEqual(["l", "s", "\r"].map(t => ({ sessionId: "s1", data: t })));
    expect(harness.sent(TerminalNames.resizeMethod)).toEqual([{ sessionId: "s1", size: { cols: 100, rows: 30 } }]);
    harness.sink.drawn = new Promise<void>(resolve => {
      draw = resolve;
    });
    const closing: Promise<void> = harness.connection.refreshAsync();
    await vi.waitFor(() => expect(harness.runtime.attachCount).toBe(3), { timeout: SpecWait.milliseconds });
    harness.connection.close();
    harness.connection.input("after");
    draw();
    await closing;

    expect(harness.sent(TerminalNames.detachMethod)).toEqual([{ sessionId: "s1", paneId: "p1" }]);
    expect(harness.sent(TerminalNames.inputMethod)).toHaveLength(3);
  });

  it("sends no sizes while a pane that isn't attached refreshes, nor once a newer attach takes over a refresh, and sends input throughout", async () => {
    const harness: ConnectionHarness = createHarness();
    harness.runtime.holdAttaches();
    const opening: Promise<void> = harness.openAsync();
    const refreshing: Promise<void> = harness.connection.refreshAsync();
    harness.connection.input("early");
    harness.runtime.releaseAttaches();
    await opening;
    await refreshing;

    harness.runtime.holdAttaches();
    const overtaken: Promise<void> = harness.connection.refreshAsync();
    harness.connection.input("a");
    TerminalConnection.reattachAll();
    harness.connection.input("b");
    harness.connection.resize(new TerminalSize(100, 30));
    harness.runtime.releaseAttaches();
    await overtaken;

    expect(harness.sent(TerminalNames.inputMethod)).toEqual(["early", "a", "b"].map(t => ({ sessionId: "s1", data: t })));
    expect(harness.sent(TerminalNames.resizeMethod)).toEqual([]);
  });

  it("stops listening and detaches when closed, once", async () => {
    const harness: ConnectionHarness = createHarness();
    await harness.openAsync();

    harness.connection.close();
    harness.connection.close();
    harness.connection.setVisible(false);
    harness.sink.callbacks.splice(0);
    harness.runtime.output("s1", 0, "after");

    expect(TerminalNames.events.map(t => harness.runtime.context.listenerCount(t))).toEqual(TerminalNames.events.map(() => 0));
    expect(harness.sent(TerminalNames.detachMethod)).toEqual([{ sessionId: "s1", paneId: "p1" }]);
    expect(harness.sink.events).toEqual(["reset 80x24 none", "write ", "title "]);
  });

  it("acknowledges nothing once closed", async () => {
    const harness: ConnectionHarness = createHarness();
    await harness.openAsync();
    harness.runtime.output("s1", 0, "abc");

    harness.connection.close();
    harness.sink.callbacks[0]?.();

    expect(harness.sent(TerminalNames.ackMethod)).toEqual([]);
  });

  it("detaches a pane closed while its first attach is held once the attach answers, drawing nothing, so the runtime counts no pane that is gone", async () => {
    const harness: ConnectionHarness = createHarness();
    harness.runtime.holdAttaches();
    const opening: Promise<void> = harness.connection.openAsync();

    harness.connection.close();
    const beforeAnswer: readonly unknown[] = [...harness.sent(TerminalNames.detachMethod)];
    harness.runtime.releaseAttaches();
    await opening;

    expect([beforeAnswer, harness.sent(TerminalNames.detachMethod)]).toEqual([[], [{ sessionId: "s1", paneId: "p1" }]]);
    expect(harness.sink.events).toEqual([]);
  });

  it("detaches a pane closed while it draws its first attach once, when the draw ends", async () => {
    const harness: ConnectionHarness = createHarness();
    let draw: () => void = () => undefined;
    harness.sink.drawn = new Promise<void>(resolve => {
      draw = resolve;
    });
    const opening: Promise<void> = harness.openAsync();
    await vi.waitFor(() => expect(harness.sink.events.at(-1)).toBe("reset 80x24 none"), { timeout: SpecWait.milliseconds });

    harness.connection.close();
    const beforeDraw: readonly unknown[] = [...harness.sent(TerminalNames.detachMethod)];
    draw();
    await opening;
    harness.connection.close();

    expect([beforeDraw, harness.sent(TerminalNames.detachMethod)]).toEqual([[], [{ sessionId: "s1", paneId: "p1" }]]);
  });

  it("attaches again at once when the runtime detaches a shown pane", async () => {
    const harness: ConnectionHarness = createHarness();
    await harness.openAsync();

    harness.runtime.detach("s1", "p2");
    harness.runtime.detach("s2", "p1");
    harness.runtime.detach("s1", "p1");

    await vi.waitFor(() => expect(harness.runtime.attachCount).toBe(2), { timeout: SpecWait.milliseconds });
  });

  it("waits until a detached hidden pane shows to attach again, and drops output meanwhile", async () => {
    const harness: ConnectionHarness = createHarness();
    await harness.openAsync(false);

    harness.runtime.detach("s1", "p1");
    harness.runtime.detach("s1", "p1");
    harness.runtime.output("s1", 0, "missed");
    expect(harness.runtime.attachCount).toBe(1);
    harness.connection.setVisible(true);

    await vi.waitFor(() => expect(harness.runtime.attachCount).toBe(2), { timeout: SpecWait.milliseconds });
    expect(harness.sink.events.includes("write missed")).toBe(false);
  });

  it("shows the terminal as lost when the runtime no longer has its session, and tries again when it next shows", async () => {
    const harness: ConnectionHarness = createHarness();
    harness.runtime.attachFailure = FakeRuntime.gone("unknown session");
    await harness.openAsync();

    harness.runtime.attachFailure = null;
    harness.connection.setVisible(false);
    harness.connection.setVisible(true);

    expect(harness.sink.events[0]).toBe("lost");
    expect(harness.runtime.context.logs).toEqual(["terminal.attach failed: unknown session"]);
    await vi.waitFor(() => expect(harness.sink.events.slice(1, 2)).toEqual(["reset 80x24 none"]), { timeout: SpecWait.milliseconds });
  });

  it("logs an attach that fails for any other reason than a gone session, such as a restarting runtime or an answer it can't read, without showing the terminal as lost, and tries again when it next shows", async () => {
    const failures: Error[] = [FakeRuntime.refusal("the runtime is restarting"), new TypeError("attachment.size is undefined")];
    for (const failure of failures) {
      const harness: ConnectionHarness = createHarness();
      harness.runtime.attachFailure = failure;
      await harness.openAsync();

      harness.runtime.attachFailure = null;
      harness.connection.setVisible(false);
      harness.connection.setVisible(true);

      await vi.waitFor(() => expect(harness.sink.events.slice(0, 1)).toEqual(["reset 80x24 none"]), { timeout: SpecWait.milliseconds });
      expect(harness.sink.events.includes("lost")).toBe(false);
      expect(harness.runtime.context.logs).toEqual([`terminal.attach failed: ${failure.message}`]);
    }
  });

  it("logs a screen its sink could not draw and shows the terminal as lost, rejecting nothing", async () => {
    const harness: ConnectionHarness = createHarness();
    harness.sink.drawFailure = new Error("The screen broke.");

    await harness.openAsync();
    harness.runtime.output("s1", 0, "late");

    expect(harness.sink.events).toEqual(["reset 80x24 none", "lost"]);
    expect(harness.runtime.context.logs).toEqual(["The terminal's screen could not be drawn, so the pane shows it as lost: The screen broke."]);
  });

  it("shows nothing when an attach fails after the pane closed", async () => {
    const harness: ConnectionHarness = createHarness();
    harness.runtime.attachFailure = FakeRuntime.gone("gone");
    harness.runtime.holdAttaches();
    const opening: Promise<void> = harness.connection.openAsync();

    harness.connection.close();
    harness.runtime.releaseAttaches();
    await opening;

    expect(harness.sink.events).toEqual([]);
  });

  it("ignores a failed attach that a newer attach replaced", async () => {
    const harness: ConnectionHarness = createHarness();
    await harness.openAsync();
    harness.runtime.holdAttaches();
    harness.runtime.attachFailure = FakeRuntime.gone("stale");
    harness.runtime.output("s1", 10, "gap");
    harness.runtime.attachFailure = null;
    TerminalConnection.reattachAll();

    harness.runtime.releaseAttaches();

    await vi.waitFor(() => expect(harness.sink.events.filter(t => t.startsWith("reset"))).toHaveLength(2), { timeout: SpecWait.milliseconds });
    expect(harness.sink.events.includes("lost")).toBe(false);
    expect(harness.runtime.context.logs).toEqual(["terminal.attach failed: stale"]);
  });

  it("ignores an older attach that answers after a newer one began", async () => {
    const harness: ConnectionHarness = createHarness();
    await harness.openAsync();
    harness.runtime.holdAttaches();
    harness.runtime.output("s1", 10, "gap");
    TerminalConnection.reattachAll();

    harness.runtime.releaseAttaches();

    await vi.waitFor(() => expect(harness.runtime.context.sent(TerminalNames.visibilityMethod)).toHaveLength(2), { timeout: SpecWait.milliseconds });
    expect(harness.sink.events.filter(t => t.startsWith("reset"))).toHaveLength(2);
  });

  it("sends no more sizes, input, visibility or acknowledgements once the runtime no longer has the session, detaches nothing when closed, and logs nothing", async () => {
    const harness: ConnectionHarness = createHarness();
    await harness.openAsync();
    harness.runtime.output("s1", 0, "abc");
    for (const method of [TerminalNames.resizeMethod, TerminalNames.inputMethod, TerminalNames.visibilityMethod, TerminalNames.detachMethod])
      harness.runtime.context.handlers.set(method, async () => {
        throw new GoneRefusal("gone");
      });

    const answers: Promise<unknown>[] = answersOf(harness);
    harness.connection.resize(new TerminalSize(90, 30));
    await Promise.allSettled(answers);
    harness.connection.resize(new TerminalSize(100, 30));
    harness.connection.input("x");
    harness.connection.setVisible(false);
    harness.sink.callbacks[0]?.();
    harness.connection.close();

    expect([TerminalNames.resizeMethod, TerminalNames.inputMethod, TerminalNames.ackMethod, TerminalNames.detachMethod].map(t => harness.sent(t).length))
      .toEqual([1, 0, 0, 0]);
    expect(harness.sent(TerminalNames.visibilityMethod)).toHaveLength(1);
    expect(harness.runtime.context.logs).toEqual([]);
  });

  it("sends input, sizes and acknowledgements again once a view refused as gone attaches again, as after the runtime restarts", async () => {
    const harness: ConnectionHarness = createHarness();
    await harness.openAsync();
    harness.runtime.context.handlers.set(TerminalNames.resizeMethod, async () => {
      throw new GoneRefusal("gone");
    });
    const answers: Promise<unknown>[] = answersOf(harness);
    harness.connection.resize(new TerminalSize(90, 30));
    await Promise.allSettled(answers);
    harness.runtime.context.handlers.delete(TerminalNames.resizeMethod);
    harness.connection.input("lost");

    TerminalConnection.reattachAll();
    await vi.waitFor(() => expect(harness.sink.events.filter(t => t === "title ")).toHaveLength(2), { timeout: SpecWait.milliseconds });
    harness.connection.resize(new TerminalSize(100, 30));
    harness.connection.input("x");
    harness.runtime.output("s1", 0, "abc");
    harness.sink.callbacks.at(-1)?.();

    expect([harness.sent(TerminalNames.attachMethod).length, harness.sent(TerminalNames.resizeMethod).length]).toEqual([2, 2]);
    expect(harness.sent(TerminalNames.inputMethod)).toEqual([{ sessionId: "s1", data: "x" }]);
    expect(harness.sent(TerminalNames.ackMethod)).toHaveLength(1);
    expect(harness.runtime.context.logs).toEqual([]);
  });

  it("keeps sending after a refusal as gone that answers a request from before the view attached again", async () => {
    const harness: ConnectionHarness = createHarness();
    await harness.openAsync();
    let refuse: (error: unknown) => void = () => undefined;
    harness.runtime.context.handlers.set(TerminalNames.resizeMethod, () => new Promise<JsonValue>((_resolve, reject) => {
      refuse = reject;
    }));
    const answers: Promise<unknown>[] = answersOf(harness);
    harness.connection.resize(new TerminalSize(90, 30));

    TerminalConnection.reattachAll();
    await vi.waitFor(() => expect(harness.sink.events.filter(t => t === "title ")).toHaveLength(2), { timeout: SpecWait.milliseconds });
    harness.runtime.context.handlers.delete(TerminalNames.resizeMethod);
    refuse(new GoneRefusal("gone"));
    await Promise.allSettled(answers);
    harness.connection.resize(new TerminalSize(100, 30));

    expect(harness.sent(TerminalNames.resizeMethod)).toHaveLength(2);
    expect(harness.runtime.context.logs).toEqual([]);
  });

  it("stops each of two views of one session once the runtime answers that the session ended, without logging, and closes both quietly", async () => {
    const harness: ConnectionHarness = createHarness();
    const other: SinkRecorder = new SinkRecorder();
    const second: TerminalConnection = new TerminalConnection(harness.runtime.context, "s1", "p2", other);
    const opening: Promise<void> = second.openAsync();
    second.setVisible(true);
    await Promise.all([harness.openAsync(), opening]);
    harness.runtime.context.handlers.set(TerminalNames.resizeMethod, async () => {
      throw new GoneRefusal("gone");
    });

    const answers: Promise<unknown>[] = answersOf(harness);
    harness.connection.resize(new TerminalSize(90, 30));
    second.resize(new TerminalSize(90, 30));
    await Promise.allSettled(answers);
    harness.connection.resize(new TerminalSize(100, 30));
    second.resize(new TerminalSize(100, 30));
    harness.connection.close();
    second.close();

    expect([harness.sent(TerminalNames.resizeMethod).length, harness.sent(TerminalNames.detachMethod).length]).toEqual([2, 0]);
    expect(harness.runtime.context.logs).toEqual([]);
  });

  it("logs a payload it can't read and a request the runtime refuses", async () => {
    const harness: ConnectionHarness = createHarness();
    await harness.openAsync();
    harness.runtime.context.handlers.set(TerminalNames.inputMethod, async () => {
      throw new Error("refused");
    });

    harness.runtime.context.emit(TerminalNames.outputEvent, { sessionId: "s1" });
    harness.connection.input("x");

    expect(harness.runtime.context.logs[0]).toMatch(/^terminal\.output failed: /u);
    await vi.waitFor(() => expect(harness.runtime.context.logs[1]).toBe("terminal.input failed: refused"), { timeout: SpecWait.milliseconds });
  });

  it("holds output that arrives while it draws a new screen, and writes the part after the screen once it is drawn", async () => {
    const harness: ConnectionHarness = createHarness();
    harness.runtime.offset = 5;
    let draw: () => void = () => undefined;
    harness.sink.drawn = new Promise<void>(resolve => {
      draw = resolve;
    });
    const opening: Promise<void> = harness.openAsync();
    await vi.waitFor(() => expect(harness.sink.events).toEqual(["reset 80x24 none"]), { timeout: SpecWait.milliseconds });

    harness.runtime.output("s1", 3, "xxyyy");
    draw();
    await opening;

    expect(harness.sink.events).toEqual(["reset 80x24 none", "write ", "title ", "write yyy"]);
  });

  it("leaves a screen it drew to the newer attach that started meanwhile, and to none once closed", async () => {
    const harness: ConnectionHarness = createHarness();
    let draw: () => void = () => undefined;
    harness.sink.drawn = new Promise<void>(resolve => {
      draw = resolve;
    });
    const opening: Promise<void> = harness.openAsync();
    await vi.waitFor(() => expect(harness.sink.events).toEqual(["reset 80x24 none"]), { timeout: SpecWait.milliseconds });
    harness.sink.drawn = Promise.resolve();
    harness.runtime.holdAttaches();

    const refreshing: Promise<void> = harness.connection.refreshAsync();
    draw();
    await opening;
    harness.runtime.releaseAttaches();
    await refreshing;

    expect(harness.sink.events).toEqual(["reset 80x24 none", "write ", "reset 80x24 none", "write ", "title "]);
    harness.sink.drawn = new Promise<void>(resolve => {
      draw = resolve;
    });
    const closing: Promise<void> = harness.connection.refreshAsync();
    await vi.waitFor(() => expect(harness.sink.events).toHaveLength(6), { timeout: SpecWait.milliseconds });
    harness.connection.close();
    draw();
    await closing;

    expect(harness.sink.events.slice(5)).toEqual(["reset 80x24 none", "write "]);
    await expect(harness.connection.refreshAsync()).resolves.toBeUndefined();
    expect(harness.runtime.attachCount).toBe(3);
  });

  it("gives the sink each output's stored range, and reads the stored lines the runtime still keeps", async () => {
    const harness: ConnectionHarness = createHarness();
    harness.runtime.storedLines = ["one", "two", "three"].map(t => new TerminalLine(t, false, [new TerminalTextRun(t.length, -1, -1, 0)]));
    harness.runtime.stored = new TerminalLineRange(1, 3, 1);
    await harness.openAsync();

    harness.runtime.output("s1", 0, "a");
    const page: TerminalLinePage = await harness.connection.readLinesAsync(0, 5);

    expect(harness.sink.followed).toEqual([new TerminalLineRange(1, 3, 1)]);
    expect([page.start, page.lines.map(t => t.text), page.stored]).toEqual([1, ["two", "three"], new TerminalLineRange(1, 3, 1)]);
    expect(harness.sent(TerminalNames.linesMethod)).toEqual([{ sessionId: "s1", start: 0, limit: 5 }]);
  });

  it("attaches every open pane again after the runtime reconnects, a hidden one once it shows", async () => {
    const shown: ConnectionHarness = createHarness();
    const hidden: ConnectionHarness = createHarness();
    const closed: ConnectionHarness = createHarness();
    await shown.openAsync();
    await hidden.openAsync(false);
    await closed.openAsync();
    closed.connection.close();

    TerminalConnection.reattachAll();

    await vi.waitFor(() => expect(shown.runtime.attachCount).toBe(2), { timeout: SpecWait.milliseconds });
    expect([hidden.runtime.attachCount, closed.runtime.attachCount]).toEqual([1, 1]);
    hidden.connection.setVisible(true);
    await vi.waitFor(() => expect(hidden.runtime.attachCount).toBe(2), { timeout: SpecWait.milliseconds });
  });
});
