/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import path from "node:path";

import { type OwnedProcess, ProcessExit, ProgramNotFoundException } from "@noldova/desktop.runtime";
import { FakeRuntimePartContext } from "@noldova/desktop.runtime/testing";
import { afterEach, describe, it } from "vitest";

import type { ILineProcessListener } from "../../src/interfaces/i-line-process-listener.ts";
import { LineProcess } from "../../src/services/line-process.ts";
import { SpawnedPrograms } from "../fixtures/spawned-programs.fixture.ts";

const NODE: string = path.basename(process.execPath);
const STAY: string = "setInterval(() => {}, 1000);";

class LineRecorder implements ILineProcessListener {
  public readonly lines: string[] = [];
  public readonly exits: string[] = [];
  private readonly waiters: (() => void)[] = [];

  public onLine(line: string): void {
    this.lines.push(line);
    this.wake();
  }

  public onExit(reason: string): void {
    this.exits.push(reason);
    this.wake();
  }

  public async untilAsync(condition: () => boolean): Promise<void> {
    while (!condition())
      await new Promise<void>(resolve => this.waiters.push(resolve));
  }

  public linesAsync(count: number): Promise<void> {
    return this.untilAsync(() => this.lines.length >= count);
  }

  public exitAsync(): Promise<void> {
    return this.untilAsync(() => this.exits.length > 0);
  }

  private wake(): void {
    for (const waiter of this.waiters.splice(0))
      waiter();
  }
}

class BrokenRecorder extends LineRecorder {
  public override onExit(reason: string): void {
    super.onExit(reason);
    throw new RangeError("listener broke");
  }
}

describe("LineProcess", () => {
  let programs: SpawnedPrograms = new SpawnedPrograms();
  let context: FakeRuntimePartContext = new FakeRuntimePartContext();
  const started: LineProcess[] = [];

  function start(script: string, recorder: LineRecorder, exited?: Promise<ProcessExit>): LineProcess {
    context.answer("startProcessAsync", t => programs.startAsync(t, exited));
    const child: LineProcess = new LineProcess(context, process.execPath, ["-e", script], recorder);
    started.push(child);
    return child;
  }

  function loggedAsync(): Promise<string> {
    return new Promise<string>(resolve => context.log.answer("write", resolve));
  }

  afterEach(async () => {
    for (const child of started.splice(0))
      child.kill();
    await programs.stopAllAsync();
    assert.deepEqual(programs.running, []);
    programs = new SpawnedPrograms();
    context = new FakeRuntimePartContext();
  });

  it("starts the program through the part's context, in its own folder with no variables of its own", async () => {
    const recorder: LineRecorder = new LineRecorder();
    start("process.exit(0);", recorder);

    await recorder.exitAsync();
    assert.deepEqual(recorder.exits, [`${NODE} exited with 0.`]);
    assert.deepEqual(programs.requests.map(t => [t.program, t.arguments, t.workingFolder, t.environment, t.inherit]),
      [[process.execPath, ["-e", "process.exit(0);"], path.dirname(process.execPath), {}, []]]);
    assert.deepEqual(context.log.callsOf("write"), []);
  });

  it("writes lines to the program and hands on each line it writes, without its line ending", async () => {
    const recorder: LineRecorder = new LineRecorder();
    const child: LineProcess = start([
      "process.stdin.setEncoding('utf8');",
      "let input = '';",
      "process.stdin.on('data', text => {",
      "  const lines = (input + text).split('\\n');",
      "  input = lines.pop();",
      "  for (const line of lines) process.stdout.write(line.toUpperCase() + '\\r\\n');",
      "});"
    ].join("\n"), recorder);

    child.write("grüße");
    child.write("zwei");

    await recorder.linesAsync(2);
    assert.deepEqual([recorder.lines, recorder.exits], [["GRÜSSE", "ZWEI"], []]);
  });

  it("joins a line the program writes in parts, and drops an unfinished last line", async () => {
    const recorder: LineRecorder = new LineRecorder();
    const child: LineProcess = start(
      "process.stdout.write('one\\r\\ntw'); process.stdin.once('data', () => process.stdout.write('o\\nthree', () => process.exit(0)));", recorder);
    await recorder.linesAsync(1);
    assert.deepEqual(recorder.lines, ["one"]);

    child.write("next");

    await recorder.exitAsync();
    assert.deepEqual([recorder.lines, recorder.exits], [["one", "two"], [`${NODE} exited with 0.`]]);
  });

  it("reports the program's exit only once its output has closed, after its last line", async () => {
    const recorder: LineRecorder = new LineRecorder();
    const exit: PromiseWithResolvers<ProcessExit> = Promise.withResolvers<ProcessExit>();
    const starting: Promise<OwnedProcess> = programs.nextStartAsync();
    const child: LineProcess = start("process.stdin.once('data', () => process.stdout.write('last\\n', () => process.exit(0)));", recorder, exit.promise);
    await starting;

    exit.resolve(new ProcessExit(0, null));
    child.write("go");

    await recorder.exitAsync();
    assert.deepEqual([recorder.lines, recorder.exits], [["last"], [`${NODE} exited with 0.`]]);
  });

  it("reports the program's exit code", async () => {
    const recorder: LineRecorder = new LineRecorder();
    start("process.exit(3);", recorder);

    await recorder.exitAsync();
    assert.deepEqual(recorder.exits, [`${NODE} exited with 3.`]);
  });

  it("writes the lines it was given while the program was starting once it has started", async () => {
    const recorder: LineRecorder = new LineRecorder();
    const child: LineProcess = start("process.stdin.setEncoding('utf8'); process.stdin.on('data', text => process.stdout.write(text));", recorder);

    child.write("first");
    child.write("second");

    await recorder.linesAsync(2);
    assert.deepEqual(recorder.lines, ["first", "second"]);
  });

  it("reports a program stopped while it was still starting, and starts nothing", async () => {
    const recorder: LineRecorder = new LineRecorder();
    const child: LineProcess = start(STAY, recorder);

    child.kill();

    await recorder.exitAsync();
    assert.deepEqual([recorder.exits, programs.programs.length, context.log.callsOf("write")], [["The program was stopped before it started."], 0, []]);
  });

  it("ends a program stopped while the part's context was starting it, and reports its end", async () => {
    const recorder: LineRecorder = new LineRecorder();
    const child: LineProcess = start(STAY, recorder);
    await Promise.resolve();
    assert.equal(programs.requests.length, 1);

    child.kill();

    await recorder.exitAsync();
    assert.deepEqual(recorder.exits, [`${NODE} exited with SIGTERM.`]);
  });

  it("reports a program that can't start, and why, without logging it", async () => {
    const recorder: LineRecorder = new LineRecorder();
    context.answer("startProcessAsync", () => Promise.reject(new ProgramNotFoundException("no-such-program")));
    started.push(new LineProcess(context, path.join(process.cwd(), "no-such-program"), [], recorder));

    await recorder.exitAsync();
    assert.deepEqual([recorder.exits, context.log.callsOf("write")], [[new ProgramNotFoundException("no-such-program").message], []]);
  });

  it("logs and reports a start that fails for another reason than the program's, with its cause", async () => {
    for (const [failure, reason] of [[new TypeError("broken", { cause: new Error("deeper") }), "broken deeper"], ["refused", "refused"]] as const) {
      const recorder: LineRecorder = new LineRecorder();
      const logged: Promise<string> = loggedAsync();
      context.answer("startProcessAsync", () => Promise.reject(failure));
      started.push(new LineProcess(context, process.execPath, [], recorder));

      assert.equal(await logged, `${NODE} failed outside its own start or end: ${reason}`);
      await recorder.exitAsync();
      assert.deepEqual(recorder.exits, [reason]);
    }
  });

  it("logs a listener that fails on the program's exit", async () => {
    const logged: Promise<string> = loggedAsync();
    start("process.exit(0);", new BrokenRecorder());

    assert.equal(await logged, `${NODE} failed outside its own start or end: listener broke`);
  });

  it("logs a listener that fails on a start that was refused", async () => {
    const logged: Promise<string> = loggedAsync();
    context.answer("startProcessAsync", () => Promise.reject(new ProgramNotFoundException("no-such-program")));
    started.push(new LineProcess(context, process.execPath, [], new BrokenRecorder()));

    assert.equal(await logged, `${NODE} failed outside its own start or end: listener broke`);
  });

  it("ends the program when killed, and reports the signal", async () => {
    const recorder: LineRecorder = new LineRecorder();
    const child: LineProcess = start(`process.stdout.write('ready\\n'); ${STAY}`, recorder);
    await recorder.linesAsync(1);

    child.kill();

    await recorder.exitAsync();
    assert.deepEqual([recorder.lines, recorder.exits], [["ready"], [`${NODE} exited with SIGTERM.`]]);
  });

  it("ends the program with the part, and reports its end", async () => {
    const recorder: LineRecorder = new LineRecorder();
    start(`process.stdout.write('ready\\n'); ${STAY}`, recorder);
    await recorder.linesAsync(1);

    await programs.stopAllAsync();

    await recorder.exitAsync();
    assert.equal(recorder.exits.length, 1);
  });

  it("reports a program whose input can't be written to", async () => {
    const recorder: LineRecorder = new LineRecorder();
    start(`process.stdout.write('ready\\n'); ${STAY}`, recorder);
    await recorder.linesAsync(1);

    programs.programs[0]?.input.emit("error", new Error("write EPIPE"));

    assert.deepEqual(recorder.exits, ["write EPIPE"]);
  });

  it("ends a program that writes more than the limit without ending its line", async () => {
    const recorder: LineRecorder = new LineRecorder();
    start(`process.stdout.write('x'.repeat(4_194_305)); ${STAY}`, recorder);

    await recorder.exitAsync();
    assert.deepEqual([recorder.lines, recorder.exits], [[], [`${NODE} exited with SIGTERM.`]]);
  });
});
