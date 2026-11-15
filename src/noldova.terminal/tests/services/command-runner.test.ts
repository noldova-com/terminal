/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import path from "node:path";

import { ArgumentException } from "@noldova/context.exceptions";
import { type OwnedProcess, ProcessExit, ProcessStartFailedException, ProgramNotFoundException } from "@noldova/desktop.runtime";
import { FakeRuntimePartContext } from "@noldova/desktop.runtime/testing";
import { afterEach, describe, it, vi } from "vitest";

import { CommandExitedException } from "../../src/exceptions/command-exited.exception.ts";
import { CommandNotStartedException } from "../../src/exceptions/command-not-started.exception.ts";
import { CommandOutputTooLongException } from "../../src/exceptions/command-output-too-long.exception.ts";
import { CommandTimedOutException } from "../../src/exceptions/command-timed-out.exception.ts";
import { CommandRunner } from "../../src/services/command-runner.ts";
import { SpawnedPrograms } from "../fixtures/spawned-programs.fixture.ts";

const NODE: string = path.basename(process.execPath);
const STAY: string = "setInterval(() => {}, 1000);";
const RUN_MS: number = 120_000;

describe("CommandRunner", () => {
  let programs: SpawnedPrograms = new SpawnedPrograms();
  let context: FakeRuntimePartContext = new FakeRuntimePartContext();

  function runAsync(script: string, timeoutMilliseconds: number = RUN_MS): Promise<string> {
    context.answer("startProcessAsync", t => programs.startAsync(t));
    return new CommandRunner(context).runAsync(process.execPath, ["-e", script], timeoutMilliseconds);
  }

  afterEach(async () => {
    await programs.stopAllAsync();
    assert.deepEqual(programs.running, []);
    programs = new SpawnedPrograms();
    context = new FakeRuntimePartContext();
  });

  it("runs the program through the part's context in its own folder with no variables of its own, and gives its whole output", async () => {
    const output: string = await runAsync("process.stdout.write('Débian 日本\\r\\n', () => process.stdout.write('End\\n'));");

    assert.equal(output, "Débian 日本\r\nEnd\n");
    assert.deepEqual(programs.requests.map(t => [t.program, t.arguments.slice(0, 1), t.workingFolder, t.environment, t.inherit]),
      [[process.execPath, ["-e"], path.dirname(process.execPath), {}, []]]);
  });

  it("gives the program the variables asked for", async () => {
    context.answer("startProcessAsync", t => programs.startAsync(t));
    const output: string = await new CommandRunner(context).runAsync(process.execPath, ["-e", "process.stdout.write(process.env.NOLDOVA_PROBE ?? '')"],
      RUN_MS, { NOLDOVA_PROBE: "given" });

    assert.deepEqual([output, programs.requests.map(t => t.environment)], ["given", [{ NOLDOVA_PROBE: "given" }]]);
  });

  it("refuses a program that exits with another code than 0", async () => {
    await assert.rejects(runAsync("process.stdout.write('partial'); process.exit(3);"), new CommandExitedException(NODE, new ProcessExit(3, null)));
  });

  it("stops a program that runs past its time", async () => {
    await assert.rejects(runAsync(STAY, 200), new CommandTimedOutException(NODE, 200));
  });

  it("stops a program that writes past the limit", async () => {
    await assert.rejects(runAsync(`process.stdout.write('x'.repeat(4_194_305)); ${STAY}`),
      new CommandOutputTooLongException(NODE, 4_194_304));
  });

  it("reports a program that can't start, and why", async () => {
    for (const failure of [new ProcessStartFailedException(process.execPath), new ProgramNotFoundException(process.execPath)]) {
      context.answer("startProcessAsync", () => Promise.reject(failure));
      await assert.rejects(new CommandRunner(context).runAsync(process.execPath, [], 1_000), (error: unknown) => {
        assert.ok(error instanceof CommandNotStartedException);
        assert.deepEqual([error.command, error.message, error.cause], [NODE, `${NODE} could not start.`, failure]);
        return true;
      });
    }
  });

  it("passes on a failure to start that isn't the program's", async () => {
    const broken: TypeError = new TypeError("broken");
    context.answer("startProcessAsync", () => Promise.reject(broken));

    await assert.rejects(new CommandRunner(context).runAsync(process.execPath, [], 1_000), broken);
  });

  it("passes on a request the part's context can't take, and starts nothing", async () => {
    await assert.rejects(new CommandRunner(context).runAsync("node", [], 1_000), ArgumentException);
    assert.deepEqual(context.callsOf("startProcessAsync"), []);
  });

  it("reports a program a signal ended", async () => {
    context.answer("startProcessAsync", t => programs.startAsync(t, Promise.resolve(new ProcessExit(null, "SIGKILL"))));

    await assert.rejects(new CommandRunner(context).runAsync(process.execPath, ["-e", ""], RUN_MS), new CommandExitedException(NODE, new ProcessExit(null, "SIGKILL")));
  });

  it("gives the output of a program that exited within its time, though its output closes only after that time", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    try {
      context.answer("startProcessAsync", t => programs.startAsync(t, Promise.resolve(new ProcessExit(0, null))));
      const started: Promise<OwnedProcess> = programs.nextStartAsync();
      const run: Promise<string> = new CommandRunner(context).runAsync(process.execPath, ["-e", STAY], 100);
      const program: OwnedProcess = await started;

      await vi.advanceTimersByTimeAsync(100);
      await program.stopAsync();

      assert.equal(await run, "");
    }
    finally {
      vi.useRealTimers();
    }
  });

  it("reports a program whose start outlasts its time at its time, and not before", async () => {
    vi.useFakeTimers();
    try {
      context.answer("startProcessAsync", request => new Promise<OwnedProcess>((_resolve, reject) => {
        const signal: AbortSignal = request.signal ?? AbortSignal.abort();
        signal.addEventListener("abort", () => reject(signal.reason));
      }));
      let isSettled: boolean = false;
      const run: Promise<string> = new CommandRunner(context).runAsync(process.execPath, [], 100);
      void run.then(() => isSettled = true, () => isSettled = true);

      await vi.advanceTimersByTimeAsync(99);
      assert.equal(isSettled, false);
      await vi.advanceTimersByTimeAsync(1);
      await assert.rejects(run, new CommandTimedOutException(NODE, 100));
    }
    finally {
      vi.useRealTimers();
    }
  });
});
