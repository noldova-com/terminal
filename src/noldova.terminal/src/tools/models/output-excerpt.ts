/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentValidator } from "@noldova/terminal.protocol";

import { Resources } from "../../resources.ts";

export class OutputExcerpt {
  public readonly text: string;
  public readonly omittedCharacters: number;

  public constructor(output: string, maximumCharacters: number) {
    ArgumentValidator.requireIntegerInRange(Resources.outputExcerptMaximumCharactersField, maximumCharacters, 1, Resources.maximumToolOutputCharacters);

    if (output.length <= maximumCharacters) {
      this.text = output;
      this.omittedCharacters = 0;
      return;
    }
    const head: string = OutputExcerpt.trimHead(output.slice(0, Math.ceil(maximumCharacters / 2)));
    const tail: string = OutputExcerpt.trimTail(output.slice(output.length - Math.floor(maximumCharacters / 2)));
    this.omittedCharacters = output.length - head.length - tail.length;
    this.text = head + Resources.formatOmittedCharacters(this.omittedCharacters) + tail;
  }

  private static trimHead(head: string): string {
    return Resources.outputExcerptHighSurrogates.test(head) ? head.slice(0, -1) : head;
  }

  private static trimTail(tail: string): string {
    return Resources.outputExcerptLowSurrogates.test(tail) ? tail.slice(1) : tail;
  }
}
