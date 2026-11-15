/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/context.exceptions";
import { JsonException, type JsonObject } from "@noldova/context.json";

import { Resources } from "../resources.ts";
import { ArgumentValidator } from "../services/argument.validator.ts";
import { ProtocolReader } from "../services/protocol.reader.ts";
import { TerminalCompletionItem } from "./terminal-completion-item.ts";

export class TerminalCompletion {
  public readonly replaceFrom: number;
  public readonly items: readonly TerminalCompletionItem[];
  public readonly isShellTab: boolean;

  public constructor(replaceFrom: number, items: readonly TerminalCompletionItem[], isShellTab: boolean = false) {
    ArgumentValidator.requireIntegerInRange(Resources.replaceFromField, replaceFrom, 0, Resources.maximumSuggestionLength);
    if (items.length > Resources.maximumCompletionItems)
      throw new ArgumentException(Resources.completionItemsTooMany, Resources.itemsField);

    this.replaceFrom = replaceFrom;
    this.items = [...items];
    this.isShellTab = isShellTab;
  }

  public static fromJson(value: unknown): TerminalCompletion {
    const reader: ProtocolReader = ProtocolReader.fromValue(value);
    reader.allowOnly([Resources.replaceFromField, Resources.itemsField, Resources.isShellTabField]);
    const replaceFrom: number = reader.readInteger(Resources.replaceFromField, 0, Resources.maximumSuggestionLength);
    const items: readonly ProtocolReader[] = reader.readObjectArray(Resources.itemsField);
    if (items.length > Resources.maximumCompletionItems) {
      const path: string = Resources.formatFieldPath(reader.path, Resources.itemsField);
      throw new JsonException(Resources.formatMoreItemsThan(Resources.maximumCompletionItems), path);
    }
    return reader.create(() => new TerminalCompletion(
      replaceFrom,
      items.map(t => TerminalCompletionItem.fromReader(t)),
      reader.readOptionalBoolean(Resources.isShellTabField) ?? false));
  }

  public toJson(): JsonObject {
    return { replaceFrom: this.replaceFrom, items: this.items.map(t => t.toJson()), isShellTab: this.isShellTab };
  }
}
