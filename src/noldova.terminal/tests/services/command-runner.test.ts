/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { ArgumentException } from "@noldova/context.exceptions";
import { type OwnedProcess, ProcessExit, ProcessRequest, ProcessStartFailedException, ProgramNotFoundException } from "@noldova/desktop.runtime";
import { FakeModuleLog, FakeRuntimePartContext } from "@noldova/desktop.runtime/testing";
import type { TerminalMissingCommands } from "@noldova/terminal.protocol";
import { afterEach, describe, it, vi } from "vitest";

import { CommandExitedException } from "../../src/exceptions/command-exited.exception.ts";
import { CommandNotStartedException } from "../../src/exceptions/command-not-started.exception.ts";
import { CommandOutputTooLongException } from "../../src/exceptions/command-output-too-long.exception.ts";
import { CommandTimedOutException } from "../../src/exceptions/command-timed-out.exception.ts";
import type { CommandRun } from "../../src/models/command-run.ts";
import { Resources } from "../../src/resources.ts";
import { CommandRunner } from "../../src/services/command-runner.ts";
import { CommandTracker } from "../../src/services/command-tracker.ts";
import { CompletionSource } from "../../src/services/completion-source.ts";
import { FakeFileSystemReader } from "../fixtures/fake-file-system-reader.fixture.ts";
import { SpawnedPrograms } from "../fixtures/spawned-programs.fixture.ts";

const NODE: string = path.basename(process.execPath);
const STAY: string = "setInterval(() => {}, 1000);";
const RUN_MS: number = 120_000;

async function stopChildAsync(pidFile: string): Promise<void> {
  let text: string;
  try {
    text = await readFile(pidFile, "utf8");
  }
  catch (error: unknown) {
    if (hasCode(error, "ENOENT"))
      return;
    throw error;
  }
  try {
    process.kill(Number(text));
  }
  catch (error: unknown) {
    if (!hasCode(error, "ESRCH"))
      throw error;
  }
  await rm(pidFile, { force: true });
}

function hasCode(error: unknown, code: string): boolean {
  return error instanceof Error && "code" in error && error.code === code;
}

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

  it("says what a program that exits with another code than 0 wrote to its errors last, at most 1,000 characters, on one line", async () => {
    await assert.rejects(runAsync("process.stderr.write('x'.repeat(2000) + 'ERROR:\\n  Access\\tdenied.\\r\\n', () => process.exit(1));"), (error: unknown) => {
      assert.ok(error instanceof CommandExitedException);
      assert.deepEqual([error.exitCode, error.errorText, error.message],
        [1, `${"x".repeat(975)}ERROR: Access denied.`, `${NODE} exited with 1: ${"x".repeat(975)}ERROR: Access denied.`]);
      return true;
    });
  });

  it("stops a program that runs past its time", async () => {
    await assert.rejects(runAsync(STAY, 200), new CommandTimedOutException(NODE, 200));
  });

  it("answers at its time for a program that runs past it, and lets the program run on to its own end", async () => {
    const signal: string = path.join(tmpdir(), `noldova-run-on-${randomUUID()}`);
    context.answer("startProcessAsync", t => programs.startAsync(t));
    const run: CommandRun = new CommandRunner(context).start(process.execPath, ["-e",
      `const t = setInterval(() => { if (require("fs").existsSync(${JSON.stringify(signal)})) { clearInterval(t); process.stdout.write("late"); } }, 20);`], 200, RUN_MS);
    try {
      await assert.rejects(run.answer, new CommandTimedOutException(NODE, 200));
      await writeFile(signal, "");
      await run.ended;

      assert.deepEqual(await Promise.all(programs.programs.map(t => t.exited)), [new ProcessExit(0, null)]);
    }
    finally {
      await rm(signal, { force: true });
    }
  });

  it("stops a program still running at its end, after it answered at its time", async () => {
    context.answer("startProcessAsync", t => programs.startAsync(t));
    const run: CommandRun = new CommandRunner(context).start(process.execPath, ["-e", STAY], 100, 400);

    await assert.rejects(run.answer, new CommandTimedOutException(NODE, 100));
    await run.ended;
    assert.deepEqual([programs.programs.length, programs.running], [1, []]);
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

  it("gives the output of a program that exited within its time, though its output closes only after that time, before its end", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    try {
      context.answer("startProcessAsync", t => programs.startAsync(t, Promise.resolve(new ProcessExit(0, null))));
      const started: Promise<OwnedProcess> = programs.nextStartAsync();
      const run: CommandRun = new CommandRunner(context).start(process.execPath, ["-e", STAY], 100, 400);
      const program: OwnedProcess = await started;

      await vi.advanceTimersByTimeAsync(399);
      await program.stopAsync();

      assert.equal(await run.answer, "");
    }
    finally {
      vi.useRealTimers();
    }
  });

  it("ends at its end a lookup whose program exited while a child it started still holds its output open, closing the output, and looks up again after", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const pidFile: string = path.join(tmpdir(), `noldova-held-output-${randomUUID()}`);
    const scripts: string[] = [`const child = require("child_process").spawn(process.execPath, ["-e", ${JSON.stringify(STAY)}], `
      + `{ stdio: ["ignore", "inherit", "inherit"], detached: true }); require("fs").writeFileSync(${JSON.stringify(pidFile)}, String(child.pid)); child.unref();`,
    "process.stdout.write('0\\n');"];
    context.answer("startProcessAsync", t => programs.startAsync(new ProcessRequest(process.execPath, ["-e", scripts.shift() ?? ""], t.workingFolder, t.environment, [], t.signal)));
    const source: CompletionSource = new CompletionSource(new FakeFileSystemReader(), new CommandRunner(context), process.platform, tmpdir(), new FakeModuleLog());
    const shell: CommandTracker = new CommandTracker(() => "");
    const names: ReadonlySet<string> = new Set(["ll"]);
    try {
      const started: Promise<OwnedProcess> = programs.nextStartAsync();
      const looking: Promise<TerminalMissingCommands> = source.findMissingPowerShellAsync(shell, process.execPath, ["gti"], names, {});
      const program: OwnedProcess = await started;
      await program.exited;
      await vi.advanceTimersByTimeAsync(Resources.powerShellLookupEndMilliseconds - 1);
      const before: readonly boolean[] = [program.output.destroyed, program.errors.destroyed];
      await vi.advanceTimersByTimeAsync(1);
      const held: readonly string[] = (await looking).names;
      await new Promise<void>(resolve => setImmediate(resolve));
      const again: readonly string[] = (await source.findMissingPowerShellAsync(shell, process.execPath, ["gti"], names, {})).names;

      assert.deepEqual([before, held, program.output.destroyed, program.errors.destroyed, again], [[false, false], [], true, true, ["gti"]]);
    }
    finally {
      vi.useRealTimers();
      await stopChildAsync(pidFile);
    }
  });

  it("closes the output of a program that starts after its end and exits while its output stays open, so its run still ends", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    try {
      const started: Promise<OwnedProcess> = programs.nextStartAsync();
      context.answer("startProcessAsync", async t => {
        await new Promise<void>(resolve => t.signal?.addEventListener("abort", () => resolve(), { once: true }));
        return programs.startAsync(new ProcessRequest(t.program, [...t.arguments], t.workingFolder, t.environment, []), Promise.resolve(new ProcessExit(null, "SIGKILL")));
      });
      const run: CommandRun = new CommandRunner(context).start(process.execPath, ["-e", STAY], 100, 400);
      const answered: Promise<void> = assert.rejects(run.answer, new CommandTimedOutException(NODE, 100));

      await vi.advanceTimersByTimeAsync(400);
      const program: OwnedProcess = await started;
      await run.ended;

      assert.deepEqual([program.output.destroyed, program.errors.destroyed], [true, true]);
      await answered;
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
