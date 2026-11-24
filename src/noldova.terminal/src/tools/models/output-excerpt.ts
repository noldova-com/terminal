/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentValidator, Resources as ProtocolResources } from "@noldova/terminal.protocol";

import { Resources } from "../../resources.ts";
import type { OutputChunk } from "./output-chunk.ts";

export class OutputExcerpt {
  public readonly text: string;
  public readonly omittedCharacters: number;

  public constructor(output: string, maximumCharacters: number, trimmedCharacters: number = 0) {
    ArgumentValidator.requireIntegerInRange(Resources.outputExcerptMaximumCharactersField, maximumCharacters, 1, Resources.maximumToolOutputCharacters);
    ArgumentValidator.requireIntegerInRange(Resources.outputExcerptTrimmedCharactersField, trimmedCharacters, 0, ProtocolResources.maximumOffset);

    const trimmed: string = trimmedCharacters === 0 ? "" : Resources.formatOmittedCharacters(trimmedCharacters);
    if (output.length <= maximumCharacters) {
      this.text = trimmed + output;
      this.omittedCharacters = trimmedCharacters;
      return;
    }
    const head: string = OutputExcerpt.trimHead(output.slice(0, Math.ceil(maximumCharacters / 2)));
    const tail: string = OutputExcerpt.trimTail(output.slice(output.length - Math.floor(maximumCharacters / 2)));
    const between: number = output.length - head.length - tail.length;
    this.omittedCharacters = trimmedCharacters + between;
    this.text = trimmed + head + Resources.formatOmittedCharacters(between) + tail;
  }

  public static of(chunk: OutputChunk, maximumCharacters: number): OutputExcerpt {
    return new OutputExcerpt(chunk.text, maximumCharacters, chunk.trimmedCharacters);
  }

  private static trimHead(head: string): string {
    return Resources.outputExcerptHighSurrogates.test(head) ? head.slice(0, -1) : head;
  }

  private static trimTail(tail: string): string {
    return Resources.outputExcerptLowSurrogates.test(tail) ? tail.slice(1) : tail;
  }
}
