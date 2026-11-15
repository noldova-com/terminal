/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { JsonReader, type JsonValue } from "@noldova/context.json";

import { Resources } from "../../resources.ts";

export class TerminalTabKey {
  public readonly view: string;
  public readonly instance: string | null;

  private constructor(view: string, instance: string | null) {
    this.view = view;
    this.instance = instance;
  }

  public static fromArguments(commandArguments: JsonValue): TerminalTabKey | null {
    if (commandArguments === null || typeof commandArguments !== "object" || Array.isArray(commandArguments))
      return null;
    const reader: JsonReader = JsonReader.fromValue(commandArguments);
    const tab: JsonValue = reader.hasField(Resources.tabArgument) ? reader.readValue(Resources.tabArgument) : null;
    if (typeof tab !== "string")
      return null;
    const [kind, view = "", ...instance] = tab.split(Resources.tabKeySeparator);
    if (kind !== Resources.viewTabKind || view === "")
      return null;
    return new TerminalTabKey(view, instance.length === 0 ? null : instance.join(Resources.tabKeySeparator));
  }
}
