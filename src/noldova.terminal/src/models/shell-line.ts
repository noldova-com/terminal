/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class ShellLine {
  public readonly words: readonly string[];
  public readonly start: number;
  public readonly value: string;
  public readonly quote: string | null;
  public readonly startsQuoted: boolean;

  public constructor(words: readonly string[], start: number, value: string, quote: string | null, startsQuoted: boolean) {
    this.words = words;
    this.start = start;
    this.value = value;
    this.quote = quote;
    this.startsQuoted = startsQuoted;
  }
}
