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

import { afterEach, beforeEach, describe, it } from "vitest";

import type { IPtyProcess } from "../../src/interfaces/i-pty-process.ts";
import { ContextPtySpawner } from "../../src/services/context-pty-spawner.ts";
import { SupervisedTerminals } from "../fixtures/supervised-terminals.fixture.ts";

const CURSOR_QUERY: string = "\u001b[6n";
const CMD: string = "C:\\Windows\\System32\\cmd.exe";

function runToExitAsync(process: IPtyProcess): Promise<string> {
  return new Promise<string>(resolve => {
    let output: string = "";
    process.onData(t => output += t);
    process.onExit(() => resolve(output));
  });
}

function readEnvironment(): Record<string, string> {
  return Object.fromEntries(Object.entries(process.env).filter((t): t is [string, string] => !Object.isUndefined(t[1])));
}

describe("ContextPtySpawner", () => {
  let terminals: SupervisedTerminals;

  beforeEach(async () => {
    terminals = await SupervisedTerminals.createAsync();
  });

  afterEach(async () => {
    await terminals.endAsync();
  });

  it("runs a program in a pseudo-terminal in a folder, with its environment, at a size", async () => {
    const spawner: ContextPtySpawner = new ContextPtySpawner(terminals.context);
    const environment: Record<string, string> = { ...readEnvironment(), NOLDOVA_TERMINAL_PROBE: "probe-value", NOLDOVA_TERMINAL_FOLDER: tmpdir() };
    const script: string = "const fs = require('node:fs'); const isInFolder = fs.realpathSync.native(process.cwd()) === fs.realpathSync.native(process.env.NOLDOVA_TERMINAL_FOLDER);"
      + " process.stdout.write(`${process.stdout.columns}x${process.stdout.rows} ${process.env.NOLDOVA_TERMINAL_PROBE} ${isInFolder ? 'in-folder' : 'elsewhere'}`)";

    for (const columns of [91, 92]) {
      const pty: IPtyProcess = await spawner.spawnAsync(process.execPath, ["-e", script], tmpdir(), columns, 17, environment, false);
      const result: string = await runToExitAsync(pty);
      assert.equal(await pty.endAsync(), true);

      assert.match(result, new RegExp(`${columns}x17 probe-value in-folder`, "u"));
      assert.ok(!result.includes(CURSOR_QUERY), "The pseudo console asked where the cursor is.");
    }
  });

  it("starts a program the runtime records for the module, and ends it through the runtime", async () => {
    const pty: IPtyProcess = await new ContextPtySpawner(terminals.context)
      .spawnAsync(process.execPath, ["-e", "setTimeout(() => {}, 60_000)"], tmpdir(), 80, 24, readEnvironment(), false);
    const exited: Promise<string> = runToExitAsync(pty);

    assert.deepEqual(terminals.processes.programs.map(t => [t.moduleId, t.processId]), [[SupervisedTerminals.moduleId, pty.pid]]);
    assert.equal(await pty.endAsync(), true);
    await exited;
    assert.deepEqual(terminals.processes.programs, []);
  });

  it("passes Command Prompt a command line as it is, with its quotes", async context => {
    context.skip(process.platform !== "win32", "Only Windows has Command Prompt, and only a Windows pseudo-terminal takes a command line as it is.");
    const pty: IPtyProcess = await new ContextPtySpawner(terminals.context)
      .spawnAsync(CMD, "/d /s /c \"echo \"a b\" & echo \"one&two\" & exit 3\"", tmpdir(), 80, 24, readEnvironment(), false);
    let code: number | undefined;
    pty.onExit(t => code = t.exitCode);

    const result: string = await runToExitAsync(pty);
    assert.equal(await pty.endAsync(), true);

    assert.match(result, /"a b"/u);
    assert.match(result, /"one&two"/u);
    assert.ok(!result.includes("\\\""), `Command Prompt was given escaped quotes: ${JSON.stringify(result)}`);
    assert.equal(code, 3);
  });

  it("refuses a command line given as it is, which only Windows takes", async context => {
    context.skip(process.platform === "win32", "Windows takes a command line as it is; the Command Prompt test covers it there.");
    const spawning: Promise<IPtyProcess> = new ContextPtySpawner(terminals.context)
      .spawnAsync(process.execPath, "-e \"process.exit(0)\"", tmpdir(), 80, 24, readEnvironment(), false);

    await assert.rejects(spawning, /was given a command line to pass as it is, which a pseudo-terminal takes only on Windows/u);
    assert.deepEqual(terminals.processes.programs, []);
  });

  it("starts a program below what the terminal shows when it inherits the cursor", async () => {
    const pty: IPtyProcess = await new ContextPtySpawner(terminals.context)
      .spawnAsync(process.execPath, ["-e", "process.stdout.write('below')"], tmpdir(), 80, 24, readEnvironment(), true);
    let isAsked: boolean = false;
    pty.onData(t => {
      if (!isAsked && t.includes(CURSOR_QUERY)) {
        isAsked = true;
        pty.write("\u001b[5;1R");
      }
    });

    const result: string = await runToExitAsync(pty);
    assert.equal(await pty.endAsync(), true);

    assert.match(result, /below/u);
    assert.equal(isAsked, process.platform === "win32");
  });
});
