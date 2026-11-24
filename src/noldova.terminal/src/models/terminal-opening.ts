/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

export class TerminalOpening {
  public readonly owner: string | null;
  public readonly connection: number | null;

  public constructor(owner: string | null, connection: number | null) {
    this.owner = owner;
    this.connection = connection;
  }

  public isReachedBy(connection: number, isApp: boolean): boolean {
    return Object.isNull(this.connection) ? !Object.isNull(this.owner) && isApp : this.connection === connection;
  }
}
