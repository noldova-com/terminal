/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonObject } from "@noldova/context.json";

import { TerminalCompletionKind } from "../enums/terminal-completion-kind.ts";
import { Resources } from "../resources.ts";
import { ArgumentValidator } from "../services/argument.validator.ts";
import { ProtocolReader } from "../services/protocol.reader.ts";

export class TerminalCompletionItem {
  public readonly text: string;
  public readonly label: string;
  public readonly kind: TerminalCompletionKind;

  public constructor(text: string, label: string, kind: TerminalCompletionKind) {
    ArgumentValidator.requireNonBlank(Resources.textField, text, Resources.maximumPathLength);
    ArgumentValidator.requireCommand(Resources.textField, text);
    ArgumentValidator.requireNonBlank(Resources.labelField, label, Resources.maximumPathLength);

    this.text = text;
    this.label = label;
    this.kind = kind;
  }

  public static fromReader(reader: ProtocolReader): TerminalCompletionItem {
    reader.allowOnly([Resources.textField, Resources.labelField, Resources.kindField]);
    return reader.create(() => new TerminalCompletionItem(
      reader.readNonBlankString(Resources.textField, Resources.maximumPathLength),
      reader.readNonBlankString(Resources.labelField, Resources.maximumPathLength),
      reader.readOneOf(Resources.kindField, Object.values(TerminalCompletionKind))));
  }

  public toJson(): JsonObject {
    return { text: this.text, label: this.label, kind: this.kind };
  }
}
