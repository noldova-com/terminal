/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class RegistryValue {
  public readonly text: string;
  public readonly isExpandable: boolean;

  public constructor(text: string, isExpandable: boolean) {
    this.text = text;
    this.isExpandable = isExpandable;
  }
}
