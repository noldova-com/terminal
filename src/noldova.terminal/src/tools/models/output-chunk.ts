/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentValidator, Resources as ProtocolResources } from "@noldova/terminal.protocol";

import { Resources } from "../../resources.ts";

export class OutputChunk {
  public readonly text: string;
  public readonly endOffset: number;

  public constructor(text: string, endOffset: number) {
    ArgumentValidator.requireIntegerInRange(Resources.outputChunkEndOffsetField, endOffset, 0, ProtocolResources.maximumOffset);

    this.text = text;
    this.endOffset = endOffset;
  }
}
