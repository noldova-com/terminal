/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IModuleLog } from "@noldova/desktop.runtime";

import type { IEnvironmentSource } from "../interfaces/i-environment-source.ts";
import type { EnvironmentTools } from "../models/environment-tools.ts";
import { Resources } from "../resources.ts";
import { InheritedEnvironment } from "./inherited-environment.ts";
import { MacEnvironment } from "./mac-environment.ts";
import { WindowsEnvironment } from "./windows-environment.ts";

export class ShellEnvironment {
  public static create(platform: string, environment: Readonly<Record<string, string | undefined>>, tools: EnvironmentTools, log: IModuleLog,
    locale: string, hasLocaleAsync: (name: string) => Promise<boolean>): IEnvironmentSource {
    if (platform === Resources.windowsPlatform)
      return new WindowsEnvironment(environment, tools, log);
    if (platform === Resources.macPlatform)
      return new MacEnvironment(environment, tools.starter, locale, hasLocaleAsync);
    return new InheritedEnvironment(environment);
  }
}
