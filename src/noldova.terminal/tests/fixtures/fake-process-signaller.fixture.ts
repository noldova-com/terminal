/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IProcessSignaller } from "../../src/interfaces/i-process-signaller.ts";

export class FakeProcessSignaller implements IProcessSignaller {
  public readonly running: Set<number> = new Set<number>();

  public isRunning(pid: number): boolean {
    return this.running.has(pid);
  }
}
