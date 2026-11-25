/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import CommandFailedException from "./command-failed.exception.ts";

export default abstract class Script {
  private static readonly JSON_PACKAGE_NAME: string = "@noldova/context.json";
  private static readonly PACKAGE_MANIFEST_PATH: string = "typescript/package.json";
  private static readonly STEP_DONE: string = " Done.";
  private static readonly STEP_FAILED: string = " Failed.";
  private static readonly TYPESCRIPT_COMPILER_DIRECTORY_NAME: string = "bin";
  private static readonly TYPESCRIPT_COMPILER_FILE_NAME: string = "tsc";
  private static readonly TYPESCRIPT_PRETTY_OPTION: string = "--pretty";
  protected static readonly TYPESCRIPT_PROJECT_OPTION: string = "--project";
  protected static readonly SOURCE_DIRECTORY_NAME: string = "src";
  protected static readonly TEXT_ENCODING: BufferEncoding = "utf8";

  public abstract runAsync(): Promise<void>;

  public async runAsEntryPointAsync(): Promise<void> {
    try {
      await this.runAsync();
    }
    catch (exception) {
      if (!(exception instanceof CommandFailedException) && !(await Script.isJsonExceptionAsync(exception)))
        throw exception;

      console.error(exception instanceof Error ? exception.message : String(exception));
      process.exitCode = 1;
    }
  }

  private static async isJsonExceptionAsync(error: unknown): Promise<boolean> {
    try {
      const { JsonException } = await import(Script.JSON_PACKAGE_NAME);
      return error instanceof JsonException;
    }
    catch {
      return false;
    }
  }

  protected async executeProcessAsync(command: string, arguments_: readonly string[], workingDirectory: string, silent: boolean = false, environment?: Record<string, string>,): Promise<void> {
    return new Promise((resolve, reject) => {
      const child = spawn(command, arguments_, { cwd: workingDirectory, stdio: silent ? "pipe" : "inherit", shell: false, env: environment === undefined ? process.env : { ...process.env, ...environment }, });
      const output: string[] = [];
      child.stdout?.on("data", (t: Buffer) => output.push(t.toString()));
      child.stderr?.on("data", (t: Buffer) => output.push(t.toString()));

      child.on("close", t => {
        if (t === 0)
          resolve();
        else
          reject(new CommandFailedException(Script.commandFailed(command, t, output.join(""))));
      });

      child.on("error", t => { reject(t); });
    });
  }

  protected async executeTypeScriptCompilerAsync(arguments_: readonly string[]): Promise<void> {
    const packagePath: string = fileURLToPath(import.meta.resolve(Script.PACKAGE_MANIFEST_PATH));
    const compilerPath: string = path.join(path.dirname(packagePath), Script.TYPESCRIPT_COMPILER_DIRECTORY_NAME, Script.TYPESCRIPT_COMPILER_FILE_NAME);

    await this.executeProcessAsync(process.execPath, [compilerPath, Script.TYPESCRIPT_PRETTY_OPTION, ...arguments_], process.cwd(), true);
  }

  protected async writeLogAsync(message: string): Promise<void> {
    console.log(message);
  }

  protected async runStepAsync(message: string, step: () => Promise<void>): Promise<void> {
    process.stdout.write(message);
    try {
      await step();
    }
    catch (exception) {
      console.log(Script.STEP_FAILED);
      throw exception;
    }
    console.log(Script.STEP_DONE);
  }

  protected async createDirectoryAsync(directoryName: string): Promise<void> {
    await fs.mkdir(directoryName, { recursive: true });
  }

  protected async removeDirectoryAsync(directoryName: string): Promise<void> {
    await fs.rm(directoryName, { recursive: true, force: true });
  }

  protected async pathExistsAsync(path: string): Promise<boolean> {
    try {
      await fs.access(path);
      return true;
    }
    catch {
      return false;
    }
  }

  protected async readFileAsync(filePath: string): Promise<string> {
    return await fs.readFile(filePath, Script.TEXT_ENCODING);
  }

  private static commandFailed(command: string, exitCode: number | null, output: string): string {
    return output.trim().length === 0 ? `Command "${command}" failed with exit code ${exitCode}.` : output.trimEnd();
  }
}
