/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import path from "node:path";

import { ArgumentException } from "@noldova/context.exceptions";
import { JsonException, JsonReader } from "@noldova/context.json";

import { CommandFailedException } from "../exceptions/command-failed.exception.ts";
import { VisualStudioUnreadableException } from "../exceptions/visual-studio-unreadable.exception.ts";
import type { ICommandRunner } from "../interfaces/i-command-runner.ts";
import type { IFileSystemReader } from "../interfaces/i-file-system-reader.ts";
import { VisualStudioInstallation } from "../models/visual-studio-installation.ts";
import { Resources } from "../resources.ts";

export class VisualStudioReader {
  private readonly runner: ICommandRunner;
  private readonly fileSystem: IFileSystemReader;
  private readonly vswhere: string | null;

  public constructor(runner: ICommandRunner, fileSystem: IFileSystemReader, programFilesX86: string | undefined) {
    this.runner = runner;
    this.fileSystem = fileSystem;
    this.vswhere = programFilesX86 === undefined || programFilesX86.length === 0 ? null : path.win32.join(programFilesX86, ...Resources.vswherePath);
  }

  public async readAsync(): Promise<readonly VisualStudioInstallation[]> {
    if (this.vswhere === null || !await this.fileSystem.isFileAsync(this.vswhere))
      return [];
    let output: string;
    try {
      output = await this.runner.runAsync(this.vswhere, Resources.vswhereArguments, Resources.shellListMilliseconds);
    }
    catch (error: unknown) {
      if (error instanceof CommandFailedException)
        throw new VisualStudioUnreadableException(error);
      throw error;
    }
    return VisualStudioReader.parse(output);
  }

  private static parse(output: string): readonly VisualStudioInstallation[] {
    let value: unknown;
    try {
      value = JSON.parse(output);
    }
    catch (error: unknown) {
      if (error instanceof SyntaxError)
        throw new VisualStudioUnreadableException(error);
      throw error;
    }
    if (!Array.isArray(value))
      throw new VisualStudioUnreadableException();
    return value.flatMap((t: unknown) => VisualStudioReader.parseInstance(t));
  }

  private static parseInstance(value: unknown): readonly VisualStudioInstallation[] {
    let instanceId: string;
    let name: string;
    let installation: string;
    try {
      const reader: JsonReader = JsonReader.fromValue(value);
      instanceId = reader.readNonBlankString(Resources.vswhereInstanceIdField);
      name = reader.readNonBlankString(Resources.vswhereDisplayNameField);
      installation = reader.readNonBlankString(Resources.vswhereInstallationPathField);
    }
    catch (error: unknown) {
      if (error instanceof JsonException)
        throw new VisualStudioUnreadableException(error);
      throw error;
    }
    try {
      return [new VisualStudioInstallation(instanceId, name, installation)];
    }
    catch (error: unknown) {
      if (error instanceof ArgumentException)
        return [];
      throw error;
    }
  }
}
