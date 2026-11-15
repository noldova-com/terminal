/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { type ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import { addAbortListener, once } from "node:events";

import { OwnedProcess, ProcessExit, type ProcessRequest, type ProcessStartException, ProcessStartFailedException, ProgramNotFoundException } from "@noldova/desktop.runtime";

export class SpawnedPrograms {
  public readonly requests: ProcessRequest[] = [];
  private readonly ends: Map<OwnedProcess, Promise<unknown>> = new Map<OwnedProcess, Promise<unknown>>();
  private readonly waiters: ((program: OwnedProcess) => void)[] = [];
  private readonly stopFailures: unknown[] = [];

  public get programs(): readonly OwnedProcess[] {
    return [...this.ends.keys()];
  }

  public get running(): readonly OwnedProcess[] {
    return this.programs.filter(t => !t.hasExited);
  }

  public startAsync(request: ProcessRequest, exited?: Promise<ProcessExit>): Promise<OwnedProcess> {
    this.requests.push(request);
    if (request.signal?.aborted === true)
      return Promise.reject(request.signal.reason);
    const child: ChildProcessWithoutNullStreams = spawn(request.program, [...request.arguments],
      { cwd: request.workingFolder, env: SpawnedPrograms.toEnvironment(request.environment), stdio: "pipe", windowsHide: true });
    return new Promise<OwnedProcess>((resolve, reject) => {
      child.once("error", error => reject(SpawnedPrograms.toStartException(request.program, error)));
      child.once("spawn", () => {
        const ended: Promise<[number | null, NodeJS.Signals | null]> = once(child, "exit").then(([code, signal]) => [code, signal]);
        const owned: OwnedProcess = new OwnedProcess(child, request.program, new Date(), exited ?? ended.then(([code, signal]) => new ProcessExit(code, signal)),
          async () => {
            child.kill();
            await ended;
          });
        if (request.signal !== undefined)
          addAbortListener(request.signal, () => void owned.stopAsync().catch((error: unknown) => void this.stopFailures.push(error)));
        this.ends.set(owned, ended);
        for (const waiter of this.waiters.splice(0))
          waiter(owned);
        resolve(owned);
      });
    });
  }

  public nextStartAsync(): Promise<OwnedProcess> {
    return new Promise<OwnedProcess>(resolve => this.waiters.push(resolve));
  }

  public async stopAllAsync(): Promise<void> {
    await Promise.all([...this.ends].map(async ([program, ended]) => {
      await program.stopAsync();
      await ended;
    }));
    assert.deepEqual(this.stopFailures.splice(0), [], "A program did not stop when its request was aborted.");
  }

  private static toStartException(program: string, error: Error): ProcessStartException {
    return "code" in error && error.code === "ENOENT" ? new ProgramNotFoundException(program) : new ProcessStartFailedException(program, { cause: error });
  }

  private static toEnvironment(environment: Readonly<Record<string, string>>): NodeJS.ProcessEnv {
    const keyOf = (name: string): string => process.platform === "win32" ? name.toUpperCase() : name;
    const replaced: ReadonlySet<string> = new Set(Object.keys(environment).map(keyOf));
    return { ...Object.fromEntries(Object.entries(process.env).filter(([t]) => !replaced.has(keyOf(t)))), ...environment };
  }
}
