/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { TerminalCompletionKind } from "@noldova/terminal.protocol";

export class CompletionCandidate {
  public readonly value: string;
  public readonly label: string;
  public readonly kind: TerminalCompletionKind;
  public readonly closesQuote: boolean;

  public constructor(value: string, label: string, kind: TerminalCompletionKind, closesQuote: boolean) {
    this.value = value;
    this.label = label;
    this.kind = kind;
    this.closesQuote = closesQuote;
  }
}
