/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonObject } from "@noldova/context.json";

import { TerminalInputEdge } from "../enums/terminal-input-edge.ts";
import { Resources } from "../resources.ts";
import { ArgumentValidator } from "../services/argument.validator.ts";
import type { ProtocolReader } from "../services/protocol.reader.ts";

export class TerminalInputMark {
  public readonly offset: number;
  public readonly edge: TerminalInputEdge;

  public constructor(offset: number, edge: TerminalInputEdge) {
    ArgumentValidator.requireIntegerInRange(Resources.offsetField, offset, 0, Resources.maximumOffset);

    this.offset = offset;
    this.edge = edge;
  }

  public static fromReader(reader: ProtocolReader): TerminalInputMark {
    reader.allowOnly([Resources.offsetField, Resources.edgeField]);
    return reader.create(() => new TerminalInputMark(
      reader.readInteger(Resources.offsetField, 0, Resources.maximumOffset),
      reader.readOneOf(Resources.edgeField, Object.values(TerminalInputEdge))));
  }

  public toJson(): JsonObject {
    return { offset: this.offset, edge: this.edge };
  }
}
