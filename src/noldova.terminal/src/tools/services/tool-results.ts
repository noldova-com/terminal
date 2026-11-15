/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonObject } from "@noldova/context.json";
import { ToolContent, ToolResult } from "@noldova/desktop.runtime";

export class ToolResults {
  public static create(text: string, structured: JsonObject, origin: string | null): ToolResult {
    return new ToolResult([ToolContent.fromText(text, origin)], structured);
  }
}
