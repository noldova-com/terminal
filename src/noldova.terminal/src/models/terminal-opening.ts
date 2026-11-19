/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class TerminalOpening {
  public readonly owner: string | null;
  public readonly connection: number | null;

  public constructor(owner: string | null, connection: number | null) {
    this.owner = owner;
    this.connection = connection;
  }

  public isReachedBy(connection: number, isApp: boolean): boolean {
    return this.connection === null ? this.owner !== null && isApp : this.connection === connection;
  }
}
