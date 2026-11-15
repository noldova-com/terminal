/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IEnvironmentSource } from "../interfaces/i-environment-source.ts";

export class InheritedEnvironment implements IEnvironmentSource {
  private readonly environment: Readonly<Record<string, string | undefined>>;

  public constructor(environment: Readonly<Record<string, string | undefined>>) {
    this.environment = environment;
  }

  public start(): void {
  }

  public readAsync(): Promise<Readonly<Record<string, string | undefined>>> {
    return Promise.resolve(this.environment);
  }

  public end(): void {
  }
}
