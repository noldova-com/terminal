/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IWindowPartContext } from "@noldova/desktop.window";

export interface IStartFolderProvider {
  readonly context: IWindowPartContext;
  readonly folder: () => string | null;
}
