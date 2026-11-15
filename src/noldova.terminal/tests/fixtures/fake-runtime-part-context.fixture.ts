/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import { addAbortListener, once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import type { JsonValue } from "@noldova/context.json";
import { QualifiedName, SettingChange, SettingKey } from "@noldova/desktop.protocol";
import { ClientClosure, EventChannel, type IMethodHandler, OwnedProcess, PermissionCenter, ProcessExit, type ProcessRequest, type ToolRegistry } from "@noldova/desktop.runtime";
import { FakeModuleLog as DesktopModuleLog, FakeModuleSettings as DesktopModuleSettings,
  FakeRuntimePartContext as DesktopRuntimePartContext } from "@noldova/desktop.runtime/testing";

import { SavedTerminals } from "../../src/services/saved-terminals.ts";
import { MemoryModuleDatabase } from "./memory-module-database.fixture.ts";
import { RegistryToolsContext } from "./registry-tools-context.fixture.ts";

const WAIT_MS: number = 60_000;

export class FakeEventChannel extends EventChannel {
  public readonly published: JsonValue[];
  public readonly targets: string[];
  private readonly listeners: Set<(payload: JsonValue) => void>;

  public constructor() {
    const published: JsonValue[] = [];
    const targets: string[] = [];
    const listeners: Set<(payload: JsonValue) => void> = new Set<(payload: JsonValue) => void>();
    super((payload, connection, window) => {
      published.push(payload);
      targets.push(connection === undefined ? "all" : `${connection}/${window ?? null}`);
      for (const listener of [...listeners])
        listener(payload);
    }, () => undefined);
    this.published = published;
    this.targets = targets;
    this.listeners = listeners;
  }

  public listen(listener: (payload: JsonValue) => void): () => void {
    this.listeners.add(listener);
    return () => void this.listeners.delete(listener);
  }

  public async waitUntilAsync(description: string, condition: () => boolean): Promise<void> {
    if (condition())
      return;
    const limit: AbortSignal = AbortSignal.timeout(WAIT_MS);
    let stop: () => void = (): void => undefined;
    try {
      await new Promise<void>((resolve, reject) => {
        limit.addEventListener("abort", () => reject(new Error(`${description} did not happen within ${WAIT_MS} ms.`)), { once: true });
        stop = this.listen(() => {
          try {
            if (condition())
              resolve();
          }
          catch (error: unknown) {
            reject(error);
          }
        });
      });
    }
    finally {
      stop();
    }
  }
}

export class FakeModuleLog extends DesktopModuleLog {
  public readonly messages: string[] = [];

  public constructor() {
    super();
    this.answer("write", t => void this.messages.push(t));
  }
}

export class FakeModuleSettings extends DesktopModuleSettings {
  public readonly values: Map<string, JsonValue> = new Map<string, JsonValue>();
  public failure: unknown = null;

  public constructor() {
    super();
    this.answer("read", name => {
      if (this.failure !== null)
        throw this.failure;
      return this.values.get(name) ?? null;
    });
  }

  public change(name: string, value: JsonValue): void {
    this.values.set(name, value);
    this.raiseChanged(name, new SettingChange(new SettingKey(QualifiedName.parse(name)), value, true));
  }
}

export class FakeRuntimePartContext extends DesktopRuntimePartContext {
  public override readonly database: MemoryModuleDatabase = new MemoryModuleDatabase(SavedTerminals.migrations);
  public override readonly settings: FakeModuleSettings = new FakeModuleSettings();
  public readonly registry: ToolRegistry = new RegistryToolsContext(this.tools, this.log, new PermissionCenter("app")).registry;
  public readonly methods: Map<string, IMethodHandler> = new Map<string, IMethodHandler>();
  public readonly events: Map<string, FakeEventChannel> = new Map<string, FakeEventChannel>();
  public readonly services: Map<string, object> = new Map<string, object>();
  public readonly requests: ProcessRequest[] = [];
  public readonly programs: OwnedProcess[] = [];
  public exit: Promise<ProcessExit> | null = null;
  public failure: Error | string | null = null;
  private workFolder: Promise<string> | null = null;

  public constructor() {
    super();
    this.answer("registerMethod", (name, handler) => void this.methods.set(name, handler));
    this.answer("declareEvent", name => {
      const channel: FakeEventChannel = new FakeEventChannel();
      this.events.set(name, channel);
      return channel;
    });
    this.answer("publishService", (name, service) => void this.services.set(name, service));
    this.answer("startProcessAsync", request => this.startAsync(request));
    this.answer("getWorkFolderAsync", () => this.workFolder ??= mkdtemp(path.join(tmpdir(), "noldova-terminal-work-")));
  }

  public async closeClientAsync(connection: number, window: number | null): Promise<void> {
    await this.raiseClientClosedAsync(new ClientClosure(connection, window));
  }

  public async endProgramsAsync(): Promise<void> {
    await Promise.all(this.programs.splice(0).map(t => t.stopAsync()));
  }

  public async endAsync(): Promise<void> {
    await this.endProgramsAsync();
    const folder: Promise<string> | null = this.workFolder;
    this.workFolder = null;
    if (folder !== null)
      await rm(await folder, { force: true, recursive: true });
  }

  private startAsync(request: ProcessRequest): Promise<OwnedProcess> {
    this.requests.push(request);
    if (request.signal?.aborted === true)
      return Promise.reject(request.signal.reason);
    if (this.failure !== null) {
      const failure: Error | string = this.failure;
      this.failure = null;
      return Promise.reject(failure);
    }
    const child: ChildProcessWithoutNullStreams = spawn(request.program, [...request.arguments],
      { cwd: request.workingFolder, env: FakeRuntimePartContext.toEnvironment(request.environment), stdio: "pipe", windowsHide: true });
    return new Promise<OwnedProcess>((resolve, reject) => {
      child.once("error", reject);
      child.once("spawn", () => {
        const exited: Promise<ProcessExit> = this.exit ?? once(child, "exit").then(([code, signal]) => new ProcessExit(code, signal));
        this.exit = null;
        const owned: OwnedProcess = new OwnedProcess(child, request.program, new Date(), exited, async () => {
          child.kill();
          await exited;
        });
        if (request.signal !== undefined)
          addAbortListener(request.signal, () => void owned.stopAsync());
        this.programs.push(owned);
        resolve(owned);
      });
    });
  }

  private static toEnvironment(environment: Readonly<Record<string, string>>): NodeJS.ProcessEnv {
    const keyOf = (name: string): string => process.platform === "win32" ? name.toUpperCase() : name;
    const replaced: ReadonlySet<string> = new Set(Object.keys(environment).map(keyOf));
    return { ...Object.fromEntries(Object.entries(process.env).filter(([t]) => !replaced.has(keyOf(t)))), ...environment };
  }
}
