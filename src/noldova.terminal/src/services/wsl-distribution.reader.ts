/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import path from "node:path";

import { CommandFailedException } from "../exceptions/command-failed.exception.ts";
import { WslDistributionsUnreadableException } from "../exceptions/wsl-distributions-unreadable.exception.ts";
import type { ICommandRunner } from "../interfaces/i-command-runner.ts";
import { Resources } from "../resources.ts";

export class WslDistributionReader {
  private readonly runner: ICommandRunner;
  private readonly powerShell: string;

  public constructor(runner: ICommandRunner, systemRoot: string) {
    this.runner = runner;
    this.powerShell = path.win32.join(systemRoot, ...Resources.windowsPowerShellPath);
  }

  public async readAsync(): Promise<readonly string[]> {
    let output: string;
    try {
      output = await this.runner.runAsync(this.powerShell, [...Resources.environmentReadArguments, WslDistributionReader.encode(Resources.wslDistributionScript)],
        Resources.shellListMilliseconds);
    }
    catch (error: unknown) {
      if (error instanceof CommandFailedException)
        throw new WslDistributionsUnreadableException(error);
      throw error;
    }
    return WslDistributionReader.parse(output.replace(Resources.wslDistributionReaderByteOrderMark, ""));
  }

  private static parse(output: string): readonly string[] {
    const lines: string[] = output.split(Resources.wslDistributionReaderLineBreak).filter(t => t.length > 0);
    if (lines.pop() !== Resources.wslEndLine)
      throw new WslDistributionsUnreadableException();
    const defaults: string[] = [];
    const others: string[] = [];
    for (const line of lines) {
      const [name, flag, ...rest] = line.split(Resources.wslDistributionReaderFieldSeparator);
      if (name === undefined || name.length === 0 || !Resources.base64Pattern.test(name) || rest.length > 0 ||
          (flag !== Resources.wslDefaultFlag && flag !== Resources.wslOtherFlag))
        throw new WslDistributionsUnreadableException();
      (flag === Resources.wslDefaultFlag ? defaults : others).push(Buffer.from(name, Resources.base64Encoding).toString(Resources.utf8Encoding));
    }
    return [...defaults, ...others];
  }

  private static encode(script: string): string {
    return Buffer.from(script, Resources.utf16Encoding).toString(Resources.base64Encoding);
  }
}
