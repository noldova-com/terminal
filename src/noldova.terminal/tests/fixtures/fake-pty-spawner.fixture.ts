/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import type { IPtyProcess } from "../../src/interfaces/i-pty-process.ts";
import type { IPtySpawner } from "../../src/interfaces/i-pty-spawner.ts";
import { FakePtyProcess } from "./fake-pty-process.fixture.ts";

export class FakePtySpawner implements IPtySpawner {
  public readonly spawned: FakePtyProcess[] = [];
  public readonly calls: string[] = [];
  public readonly environments: Readonly<Record<string, string>>[] = [];
  public readonly inheritsCursor: boolean[] = [];
  public failure: Error | string | null = null;
  public hold: Promise<void> | null = null;
  public readonly held: PromiseWithResolvers<void> = Promise.withResolvers<void>();
  public holding: number = 0;
  public isEndable: boolean = true;
  private readonly waiting: PromiseWithResolvers<FakePtyProcess>[] = [];

  public nextSpawnAsync(): Promise<FakePtyProcess> {
    const next: PromiseWithResolvers<FakePtyProcess> = Promise.withResolvers<FakePtyProcess>();
    this.waiting.push(next);
    return next.promise;
  }

  public async spawnAsync(
    file: string,
    args: readonly string[] | string,
    folder: string,
    columns: number,
    rows: number,
    environment: Readonly<Record<string, string>>,
    inheritCursor: boolean): Promise<IPtyProcess> {
    if (!Object.isNull(this.failure))
      throw this.failure;
    if (!Object.isNull(this.hold)) {
      this.holding++;
      this.held.resolve();
      await this.hold;
    }
    const process: FakePtyProcess = new FakePtyProcess(1_000 + this.spawned.length);
    process.isEndable = this.isEndable;
    this.calls.push(`${file} [${Object.isString(args) ? args : args.join(" ")}] in ${folder} at ${columns}x${rows}`);
    this.environments.push(environment);
    this.inheritsCursor.push(inheritCursor);
    this.spawned.push(process);
    for (const next of this.waiting.splice(0))
      next.resolve(process);
    return process;
  }
}
