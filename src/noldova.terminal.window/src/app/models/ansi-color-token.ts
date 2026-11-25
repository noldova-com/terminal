/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import type { AnsiColor } from "../types/ansi-color.ts";
import type { AnsiKey } from "../types/ansi-key.ts";

export class AnsiColorToken {
  public readonly key: AnsiKey;
  public readonly name: AnsiColor;

  public constructor(key: AnsiKey, name: AnsiColor) {
    this.key = key;
    this.name = name;
  }
}
