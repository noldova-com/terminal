/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IRuntimePartContext } from "@noldova/desktop.runtime";

import type { ILineProcess } from "../interfaces/i-line-process.ts";
import type { ILineProcessListener } from "../interfaces/i-line-process-listener.ts";
import type { ILineProcessStarter } from "../interfaces/i-line-process-starter.ts";
import { LineProcess } from "./line-process.ts";

export class LineProcessStarter implements ILineProcessStarter {
  private readonly context: IRuntimePartContext;

  public constructor(context: IRuntimePartContext) {
    this.context = context;
  }

  public start(file: string, args: readonly string[], listener: ILineProcessListener): ILineProcess {
    return new LineProcess(this.context, file, args, listener);
  }
}
