/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ILineProcessListener } from "./i-line-process-listener.ts";
import type { ILineProcess } from "./i-line-process.ts";

export interface ILineProcessStarter {
  start(file: string, args: readonly string[], listener: ILineProcessListener): ILineProcess;
}
