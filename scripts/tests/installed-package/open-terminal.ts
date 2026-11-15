/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdtemp, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { PassThrough } from "node:stream";

import type { JsonValue } from "@noldova/context.json";
import { ShellClients } from "@noldova/desktop.protocol";
import { DataDirectory, EventChannel, type IMethodHandler, OwnershipLock, ProcessSupervisor, RequestContext, ShellDatabase, ShellMigrations } from "@noldova/desktop.runtime";
import { FakeRuntimePartContext } from "@noldova/desktop.runtime/testing";
import { RuntimePart } from "@noldova/terminal/runtime";

import { InstalledPartFailedException } from "./installed-part-failed.exception.ts";
import { OpenTerminalResources } from "./open-terminal.resources.ts";

class InstalledTerminal {
  private readonly handlers: Map<string, IMethodHandler> = new Map<string, IMethodHandler>();
  private readonly echoed: PromiseWithResolvers<void> = Promise.withResolvers<void>();
  private output: string = "";

  private static field(value: unknown, name: string): unknown {
    return typeof value === "object" && value !== null && !Array.isArray(value) ? Object.fromEntries(Object.entries(value))[name] : undefined;
  }

  public async runAsync(): Promise<void> {
    const require: NodeJS.Require = createRequire(import.meta.url);
    console.log(OpenTerminalResources.formatResolved(OpenTerminalResources.runtimePackage, require.resolve(OpenTerminalResources.runtimePackage)));
    console.log(OpenTerminalResources.formatResolved(OpenTerminalResources.ptyPackage, require.resolve(OpenTerminalResources.ptyPackage)));
    const folder: string = await mkdtemp(path.join(tmpdir(), OpenTerminalResources.dataPrefix));
    const lock: OwnershipLock = OwnershipLock.acquire(new DataDirectory(folder));
    try {
      const database: ShellDatabase = await ShellDatabase.openAsync(lock, ShellMigrations.all);
      try {
        const processes: ProcessSupervisor = ProcessSupervisor.create(database, process.platform, process.env, new PassThrough().resume());
        try {
          await this.openAsync(this.createContext(processes));
        }
        finally {
          await processes.stopAllAsync();
        }
      }
      finally {
        database.close();
      }
    }
    finally {
      lock.release();
      await rm(folder, { recursive: true, force: true });
    }
  }

  private createContext(processes: ProcessSupervisor): FakeRuntimePartContext {
    const context: FakeRuntimePartContext = new FakeRuntimePartContext();
    context.answer("moduleId", OpenTerminalResources.moduleId);
    context.answer("getWorkFolderAsync", () => Promise.resolve(tmpdir()));
    context.answer("startProcessAsync", request => processes.startAsync(OpenTerminalResources.moduleId, request));
    context.answer("startPseudoTerminalAsync", request => processes.startPseudoTerminalAsync(OpenTerminalResources.moduleId, request));
    context.answer("registerMethod", (name, handler) => void this.handlers.set(name, handler));
    context.answer("declareEvent", name => new EventChannel(payload => this.publish(name, payload), () => undefined));
    context.database.answer("read", () => undefined);
    context.database.answer("readAll", () => []);
    context.database.answer("run", () => ({ changes: 0, lastInsertRowid: 0 }));
    context.database.answer("transaction", action => action());
    context.settings.answer("read", () => null);
    return context;
  }

  private publish(name: string, payload: JsonValue): void {
    const data: unknown = InstalledTerminal.field(payload, OpenTerminalResources.dataField);
    if (name !== OpenTerminalResources.outputEvent || typeof data !== "string")
      return;
    this.output += data;
    const answer: number = this.output.indexOf(OpenTerminalResources.marker);
    if (answer >= 0 && this.output.includes(OpenTerminalResources.promptEndMark, answer))
      this.echoed.resolve();
  }

  private async openAsync(context: FakeRuntimePartContext): Promise<void> {
    const part: RuntimePart = new RuntimePart();
    try {
      await part.activateAsync(context);
      const listed: unknown = InstalledTerminal.field(await this.callAsync(OpenTerminalResources.shellsMethod, null), OpenTerminalResources.shellsField);
      const shells: readonly unknown[] = Array.isArray(listed) ? listed : [];
      const shell: unknown = shells.find(t => InstalledTerminal.field(t, OpenTerminalResources.defaultField) === true) ?? shells[0];
      const shellId: unknown = InstalledTerminal.field(shell, OpenTerminalResources.idField);
      if (typeof shellId !== "string")
        throw new InstalledPartFailedException(OpenTerminalResources.noShell);
      const size: JsonValue = { cols: OpenTerminalResources.columns, rows: OpenTerminalResources.rows };
      const opened: JsonValue = await this.callAsync(OpenTerminalResources.openMethod, { shellId, folder: tmpdir(), size, storedLimit: OpenTerminalResources.storedLimit });
      const sessionId: unknown = InstalledTerminal.field(opened, OpenTerminalResources.sessionField);
      if (typeof sessionId !== "string")
        throw new InstalledPartFailedException(OpenTerminalResources.noTerminal);
      const deadline: AbortSignal = AbortSignal.timeout(OpenTerminalResources.echoTimeout);
      deadline.addEventListener("abort", () => this.echoed.reject(new InstalledPartFailedException(OpenTerminalResources.formatEchoMissing(this.output))), { once: true });
      await this.callAsync(OpenTerminalResources.inputMethod, { sessionId, data: `${OpenTerminalResources.command}${OpenTerminalResources.enter}` });
      await this.echoed.promise;
      await this.callAsync(OpenTerminalResources.closeMethod, { sessionId });
      console.log(OpenTerminalResources.formatOpened(shellId));
    }
    finally {
      await part.deactivateAsync();
    }
    InstalledTerminal.checkAfterwards(context);
  }

  private static checkAfterwards(context: FakeRuntimePartContext): void {
    const logged: readonly string[] = context.log.callsOf("write").map(t => String(t[0]));
    if (logged.length > 0)
      throw new InstalledPartFailedException(OpenTerminalResources.formatLogged(logged));
    const statements: readonly string[] = context.database.callsOf("run").map(t => String(t[0]).split(OpenTerminalResources.statementSeparator)[0] ?? "");
    if (statements[0] !== OpenTerminalResources.insertStatement || statements.at(-1) !== OpenTerminalResources.deleteStatement)
      throw new InstalledPartFailedException(OpenTerminalResources.formatStatements(statements));
    const tools: readonly string[] = context.tools.callsOf("register").map(t => String(InstalledTerminal.field(t[0], OpenTerminalResources.nameField)));
    const active: number = context.tools.activeCallsOf("register").length;
    if (tools.length === 0 || active > 0)
      throw new InstalledPartFailedException(OpenTerminalResources.formatTools(tools, active));
  }

  private async callAsync(name: string, payload: JsonValue): Promise<JsonValue> {
    const handler: IMethodHandler | undefined = this.handlers.get(name);
    if (handler === undefined)
      throw new InstalledPartFailedException(OpenTerminalResources.formatMethodMissing(name));
    const signal: AbortSignal = AbortSignal.timeout(OpenTerminalResources.requestTimeout);
    return handler.handleAsync(new RequestContext(ShellClients.mainProcess, payload, signal, OpenTerminalResources.connection, OpenTerminalResources.window));
  }
}

await new InstalledTerminal().runAsync();
