/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class HereDocument {
  public readonly delimiter: string;
  public readonly stripsTabs: boolean;

  public constructor(delimiter: string, stripsTabs: boolean) {
    this.delimiter = delimiter;
    this.stripsTabs = stripsTabs;
  }
}
