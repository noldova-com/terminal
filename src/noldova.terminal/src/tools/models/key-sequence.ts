/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/context.exceptions";
import { Resources as ProtocolResources } from "@noldova/terminal.protocol";

import { Resources } from "../../resources.ts";
import { TerminalTextEscaper } from "../services/terminal-text-escaper.ts";

export class KeySequence {
  public readonly text: string;

  public constructor(text: string) {
    if (text.length === 0)
      throw new ArgumentException(Resources.noKeys, Resources.keysField);
    if (Buffer.byteLength(text, Resources.utf8Encoding) > Resources.maximumKeysBytes)
      throw new ArgumentException(Resources.formatTooManyBytes(ProtocolResources.valueSubject, Resources.maximumKeysBytes), Resources.keysField);

    this.text = text;
  }

  public get display(): string {
    return TerminalTextEscaper.escape(this.text);
  }

  public get hasHiddenCharacters(): boolean {
    return TerminalTextEscaper.hasHiddenCharacters(this.text);
  }
}
