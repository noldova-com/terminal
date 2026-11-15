/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/context.exceptions";
import { ArgumentValidator, Resources as ProtocolResources } from "@noldova/terminal.protocol";

import { Resources } from "../../resources.ts";
import { TerminalTextEscaper } from "../services/terminal-text-escaper.ts";

export class CommandLine {
  public readonly text: string;

  public constructor(text: string) {
    ArgumentValidator.requireNonBlank(Resources.commandField, text, Resources.maximumCommandBytes);
    if (Buffer.byteLength(text, Resources.utf8Encoding) > Resources.maximumCommandBytes)
      throw new ArgumentException(Resources.formatTooManyBytes(ProtocolResources.valueSubject, Resources.maximumCommandBytes), Resources.commandField);
    if (TerminalTextEscaper.hasControls(text))
      throw new ArgumentException(Resources.commandHasControls, Resources.commandField);

    this.text = text;
  }

  public get display(): string {
    return TerminalTextEscaper.escape(this.text);
  }

  public get hasHiddenCharacters(): boolean {
    return TerminalTextEscaper.hasHiddenCharacters(this.text);
  }
}
