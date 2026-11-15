/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { PassThrough } from "node:stream";

import { DataDirectory, OwnershipLock, type PseudoTerminal, type PseudoTerminalRequest, ProcessSupervisor, ShellDatabase,
  ShellMigrations } from "@noldova/desktop.runtime";

import { FakeRuntimePartContext } from "./fake-runtime-part-context.fixture.ts";

export class SupervisedTerminals {
  public static readonly moduleId: string = "terminal";
  public readonly processes: ProcessSupervisor;
  public readonly context: FakeRuntimePartContext = new FakeRuntimePartContext();
  private readonly folder: string;
  private readonly lock: OwnershipLock;
  private readonly database: ShellDatabase;

  private constructor(folder: string, lock: OwnershipLock, database: ShellDatabase) {
    this.folder = folder;
    this.lock = lock;
    this.database = database;
    this.processes = ProcessSupervisor.create(database, process.platform, process.env, new PassThrough().resume());
    this.serve(this.context);
  }

  public static async createAsync(): Promise<SupervisedTerminals> {
    const folder: string = await mkdtemp(path.join(tmpdir(), "noldova-terminal-supervised-"));
    const lock: OwnershipLock = OwnershipLock.acquire(new DataDirectory(folder));
    return new SupervisedTerminals(folder, lock, await ShellDatabase.openAsync(lock, ShellMigrations.all));
  }

  public serve(context: FakeRuntimePartContext): void {
    context.answer("startPseudoTerminalAsync", t => this.startAsync(t));
  }

  public startAsync(request: PseudoTerminalRequest): Promise<PseudoTerminal> {
    return this.processes.startPseudoTerminalAsync(SupervisedTerminals.moduleId, request);
  }

  public async endAsync(): Promise<void> {
    try {
      await this.processes.stopAllAsync();
    }
    finally {
      this.database.close();
      this.lock.release();
      await rm(this.folder, { recursive: true, force: true });
    }
  }
}
