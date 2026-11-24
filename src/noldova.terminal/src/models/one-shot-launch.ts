/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import { Resources } from "../resources.ts";

export class OneShotLaunch {
  public readonly file: string;
  public readonly args: readonly string[] | string;
  public readonly environment: Readonly<Record<string, string>>;

  public constructor(file: string, args: readonly string[] | string, environment: Readonly<Record<string, string>> = {}) {
    this.file = file;
    this.args = args;
    this.environment = environment;
  }

  public get commandLine(): string {
    if (!Object.isString(this.args))
      return [this.file, ...this.args].map(t => OneShotLaunch.quote(t)).join(Resources.oneShotLaunchArgumentSeparator);
    let line: string = this.args;
    for (const [name, value] of Object.entries(this.environment))
      line = line.replaceAll(Resources.formatOneShotLaunchDelayedVariable(name), value);
    return Resources.formatOneShotLaunchCommandLine(OneShotLaunch.quote(this.file), line);
  }

  private static quote(argument: string): string {
    const isQuoted: boolean = argument === "" || (Resources.oneShotLaunchArgumentBreak.test(argument) && argument.length > 1
      && !(argument.startsWith(Resources.doubleQuote) && argument.endsWith(Resources.doubleQuote)));
    let quoted: string = isQuoted ? Resources.doubleQuote : "";
    let backslashes: number = 0;
    for (const unit of argument) {
      if (unit === Resources.backslash)
        backslashes++;
      else {
        quoted += Resources.backslash.repeat(unit === Resources.doubleQuote ? backslashes * 2 + 1 : backslashes) + unit;
        backslashes = 0;
      }
    }
    return isQuoted ? `${quoted}${Resources.backslash.repeat(backslashes * 2)}${Resources.doubleQuote}`
      : quoted + Resources.backslash.repeat(backslashes);
  }
}
