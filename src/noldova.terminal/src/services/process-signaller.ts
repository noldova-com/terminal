/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IProcessSignaller } from "../interfaces/i-process-signaller.ts";
import { Resources } from "../resources.ts";

export class ProcessSignaller implements IProcessSignaller {
  public isRunning(pid: number): boolean {
    try {
      process.kill(pid, 0);
      return true;
    }
    catch (error: unknown) {
      return error instanceof Error && "code" in error && error.code === Resources.processAliveCode;
    }
  }
}
