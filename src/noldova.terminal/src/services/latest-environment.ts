/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IEnvironmentSource } from "../interfaces/i-environment-source.ts";

export class LatestEnvironment {
  private readonly source: IEnvironmentSource;
  private readonly inherited: Readonly<Record<string, string | undefined>>;
  private latest: Readonly<Record<string, string | undefined>>;
  private reading: Promise<void> | null = null;

  public constructor(source: IEnvironmentSource, inherited: Readonly<Record<string, string | undefined>>) {
    this.source = source;
    this.inherited = inherited;
    this.latest = inherited;
  }

  public async readAsync(): Promise<Readonly<Record<string, string | undefined>>> {
    const environment: Readonly<Record<string, string | undefined>> | null = await this.source.readAsync();
    if (environment === null)
      return this.inherited;
    this.latest = environment;
    return environment;
  }

  public read(): Readonly<Record<string, string | undefined>> {
    this.reading ??= this.readAsync().catch(() => undefined).then(() => {
      this.reading = null;
    });
    return this.latest;
  }
}
