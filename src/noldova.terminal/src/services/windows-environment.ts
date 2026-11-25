/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import path from "node:path";

import type { IModuleLog } from "@noldova/desktop.runtime";

import { CommandExitedException } from "../exceptions/command-exited.exception.ts";
import { EnvironmentKeyUnreadableException } from "../exceptions/environment-key-unreadable.exception.ts";
import { EnvironmentExportInvalidException } from "../exceptions/environment-export-invalid.exception.ts";
import { SystemRootMissingException } from "../exceptions/system-root-missing.exception.ts";
import type { IEnvironmentSource } from "../interfaces/i-environment-source.ts";
import type { EnvironmentTools } from "../models/environment-tools.ts";
import { EnvironmentVariable } from "../models/environment-variable.ts";
import type { RegistryValue } from "../models/registry-value.ts";
import { Resources } from "../resources.ts";
import { FailureText } from "./failure-text.ts";
import { RegistryExport } from "./registry-export.ts";

export class WindowsEnvironment implements IEnvironmentSource {
  private readonly environment: Readonly<Record<string, string | undefined>>;
  private readonly tools: EnvironmentTools;
  private readonly log: IModuleLog;
  private readonly reg: string | null;
  private readonly ending: PromiseWithResolvers<void> = Promise.withResolvers<void>();
  private reading: Promise<Readonly<Record<string, string | undefined>> | null> | null = null;
  private folder: Promise<string> | null = null;
  private readCount: number = 0;
  private ended: boolean = false;

  public constructor(environment: Readonly<Record<string, string | undefined>>, tools: EnvironmentTools, log: IModuleLog) {
    const systemRoot: string | undefined = environment[Resources.systemRootVariable];
    this.environment = environment;
    this.tools = tools;
    this.log = log;
    this.reg = Object.isUndefined(systemRoot) || systemRoot.length === 0 ? null : path.win32.join(systemRoot, ...Resources.regPath);
  }

  public start(): void {
    void this.readAsync();
  }

  public readAsync(): Promise<Readonly<Record<string, string | undefined>> | null> {
    if (this.ended)
      return Promise.resolve(this.environment);
    if (Object.isNull(this.reading)) {
      const reading: Promise<Readonly<Record<string, string | undefined>> | null> = Promise.race([this.readNowAsync(), this.ending.promise.then(() => this.environment)]);
      this.reading = reading;
      void reading.then(() => {
        this.reading = null;
      });
    }
    return this.reading;
  }

  public end(): void {
    this.ended = true;
    this.ending.resolve();
    const folder: Promise<string> | null = this.folder;
    this.folder = null;
    void folder?.then(t => this.tools.writer.removeFolderAsync(t)).catch((error: unknown) => this.logCleanupFailure(error));
  }

  private async readNowAsync(): Promise<Readonly<Record<string, string | undefined>> | null> {
    try {
      const reg: string | null = this.reg;
      if (Object.isNull(reg))
        throw new SystemRootMissingException();
      const folder: string | null = await this.prepareFolderAsync();
      if (Object.isNull(folder) || this.ended)
        return this.environment;
      const read: number = ++this.readCount;
      try {
        const machine: ReadonlyMap<string, RegistryValue> = await this.readScopeAsync(reg, Resources.machineEnvironmentKey, folder,
          `${Resources.windowsEnvironmentMachineFilePrefix}${read}`);
        if (this.ended)
          return this.environment;
        const user: ReadonlyMap<string, RegistryValue> = await this.readScopeAsync(reg, Resources.userEnvironmentKey, folder,
          `${Resources.windowsEnvironmentUserFilePrefix}${read}`);
        return WindowsEnvironment.build(this.environment, machine, user);
      }
      finally {
        if (this.ended)
          await this.tools.writer.removeFolderAsync(folder).catch((error: unknown) => this.logCleanupFailure(error));
      }
    }
    catch (error: unknown) {
      this.log.write(Resources.formatEnvironmentUnread(FailureText.read(error)));
      return null;
    }
  }

  private async prepareFolderAsync(): Promise<string | null> {
    const folder: string | null = await this.ensureFolderAsync();
    if (Object.isNull(folder) || await this.tools.reader.isFolderAsync(folder))
      return folder;
    this.folder = null;
    return await this.ensureFolderAsync();
  }

  private async ensureFolderAsync(): Promise<string | null> {
    if (this.ended)
      return null;
    this.folder ??= this.createFolderAsync();
    try {
      return await this.folder;
    }
    catch (error: unknown) {
      this.folder = null;
      throw error;
    }
  }

  private async createFolderAsync(): Promise<string> {
    const folder: string = await this.tools.writer.createPrivateFolderAsync(path.join(this.tools.temporaryFolder, Resources.environmentFolderPrefix));
    try {
      await this.tools.access?.restrictAsync(folder);
    }
    catch (error: unknown) {
      await this.tools.writer.removeFolderAsync(folder).catch((removalError: unknown) => this.logCleanupFailure(removalError));
      throw error;
    }
    return folder;
  }

  private async readScopeAsync(reg: string, key: string, folder: string, name: string): Promise<ReadonlyMap<string, RegistryValue>> {
    let file: string = path.win32.join(folder, `${name}${Resources.windowsEnvironmentExportExtension}`);
    const files: string[] = [file];
    try {
      try {
        await this.exportAsync(reg, key, file);
      }
      catch (error: unknown) {
        if (!(error instanceof CommandExitedException) || Object.isNull(error.exitCode))
          throw new EnvironmentKeyUnreadableException(key, error);
        const isPresent: boolean = await this.isPresentAsync(reg, key).catch((): never => {
          throw new EnvironmentKeyUnreadableException(key, error);
        });
        if (!isPresent && key === Resources.userEnvironmentKey)
          return new Map<string, RegistryValue>();
        if (!isPresent)
          throw new EnvironmentKeyUnreadableException(key, error);
        this.log.write(Resources.formatEnvironmentExportRetried(key, error.errorText));
        await this.waitAsync(Resources.environmentExportRetryMilliseconds);
        if (this.ended)
          return new Map<string, RegistryValue>();
        file = path.win32.join(folder, `${name}${Resources.windowsEnvironmentRetryFileSuffix}${Resources.windowsEnvironmentExportExtension}`);
        files.push(file);
        await this.exportAsync(reg, key, file).catch((retryError: unknown): never => {
          throw new EnvironmentKeyUnreadableException(key, retryError);
        });
      }
      const bytes: Uint8Array | null = await this.tools.reader.readBytesOrNullAsync(file);
      if (Object.isNull(bytes))
        throw new EnvironmentExportInvalidException();
      return RegistryExport.parse(new TextDecoder(Resources.registryExportUtf16Label).decode(bytes));
    }
    finally {
      for (const written of files)
        await this.tools.writer.removeFileAsync(written).catch((error: unknown) => this.logCleanupFailure(error));
    }
  }

  private async exportAsync(reg: string, key: string, file: string): Promise<void> {
    await this.tools.runner.runAsync(reg, [Resources.regExportArgument, key, file, Resources.regOverwriteArgument], Resources.environmentReadMilliseconds);
  }

  private async isPresentAsync(reg: string, key: string): Promise<boolean> {
    try {
      await this.tools.runner.runAsync(reg, [Resources.regQueryArgument, key], Resources.environmentReadMilliseconds);
      return true;
    }
    catch (error: unknown) {
      if (error instanceof CommandExitedException && !Object.isNull(error.exitCode))
        return false;
      throw error;
    }
  }

  private async waitAsync(milliseconds: number): Promise<void> {
    let timer: NodeJS.Timeout | undefined;
    await Promise.race([new Promise<void>(resolve => {
      timer = setTimeout(resolve, milliseconds);
    }), this.ending.promise]);
    clearTimeout(timer);
  }

  private logCleanupFailure(error: unknown): void {
    this.log.write(Resources.formatEnvironmentCleanupFailed(FailureText.read(error)));
  }

  private static build(environment: Readonly<Record<string, string | undefined>>, machine: ReadonlyMap<string, RegistryValue>,
    user: ReadonlyMap<string, RegistryValue>): Readonly<Record<string, string>> {
    const variables: Map<string, EnvironmentVariable> = new Map<string, EnvironmentVariable>();
    for (const [name, value] of Object.entries(environment)) {
      if (!Object.isUndefined(value))
        variables.set(name.toUpperCase(), new EnvironmentVariable(name, value));
    }
    const machinePath: EnvironmentVariable | undefined = WindowsEnvironment.apply(variables, machine);
    const userPath: EnvironmentVariable | undefined = WindowsEnvironment.apply(variables, user);
    if (!Object.isUndefined(machinePath) && !Object.isUndefined(userPath))
      variables.set(Resources.pathVariable, new EnvironmentVariable(machinePath.name, `${machinePath.value}${path.win32.delimiter}${userPath.value}`));
    return Object.fromEntries([...variables.values()].map(t => [t.name, t.value]));
  }

  private static apply(variables: Map<string, EnvironmentVariable>, scope: ReadonlyMap<string, RegistryValue>): EnvironmentVariable | undefined {
    let scopePath: EnvironmentVariable | undefined;
    for (const isExpandedPass of [false, true]) {
      for (const [name, value] of scope) {
        if (value.isExpandable !== isExpandedPass)
          continue;
        const variable: EnvironmentVariable = new EnvironmentVariable(name, value.isExpandable ? WindowsEnvironment.expand(value.text, variables) : value.text);
        variables.set(name.toUpperCase(), variable);
        if (name.toUpperCase() === Resources.pathVariable)
          scopePath = variable;
      }
    }
    return scopePath;
  }

  private static expand(value: string, variables: ReadonlyMap<string, EnvironmentVariable>): string {
    let text: string = "";
    let index: number = 0;
    for (;;) {
      const start: number = value.indexOf(Resources.windowsEnvironmentVariableDelimiter, index);
      const end: number = start === -1 ? -1 : value.indexOf(Resources.windowsEnvironmentVariableDelimiter, start + 1);
      if (end === -1)
        return text + value.slice(index);
      const variable: EnvironmentVariable | undefined = variables.get(value.slice(start + 1, end).toUpperCase());
      if (Object.isUndefined(variable)) {
        text += value.slice(index, end);
        index = end;
      }
      else {
        text += value.slice(index, start) + variable.value;
        index = end + 1;
      }
    }
  }
}
