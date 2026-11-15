/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonObject } from "@noldova/context.json";

import { Resources } from "../resources.ts";
import { ProtocolReader } from "../services/protocol.reader.ts";
import { TerminalShell } from "./terminal-shell.ts";

export class TerminalShells {
  public readonly shells: readonly TerminalShell[];

  public constructor(shells: readonly TerminalShell[]) {
    this.shells = [...shells];
  }

  public static fromJson(value: unknown): TerminalShells {
    const reader: ProtocolReader = ProtocolReader.fromValue(value);
    reader.allowOnly([Resources.shellsField]);
    return reader.create(() => new TerminalShells(
      reader.readObjectArray(Resources.shellsField).map(t => TerminalShell.fromReader(t))));
  }

  public toJson(): JsonObject {
    return { shells: this.shells.map(t => t.toJson()) };
  }
}
