/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IViewUpdate } from "@noldova/desktop.window";

export class UpdatedView {
  public readonly instance: string;
  public readonly update: IViewUpdate;

  public constructor(instance: string, update: IViewUpdate) {
    this.instance = instance;
    this.update = update;
  }
}
