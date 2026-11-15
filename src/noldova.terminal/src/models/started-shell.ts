/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IPtyProcess } from "../interfaces/i-pty-process.ts";
import type { DeferredPtyProcess } from "../services/deferred-pty-process.ts";

export class StartedShell {
  public readonly process: IPtyProcess;
  public readonly nonce: string | null;
  public readonly printsNote: boolean;
  public readonly deferred: DeferredPtyProcess | null;

  public constructor(process: IPtyProcess, nonce: string | null, printsNote: boolean, deferred: DeferredPtyProcess | null) {
    this.process = process;
    this.nonce = nonce;
    this.printsNote = printsNote;
    this.deferred = deferred;
  }
}
