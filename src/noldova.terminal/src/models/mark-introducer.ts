/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class MarkIntroducer {
  public readonly start: number;
  public readonly text: string;

  public constructor(start: number, text: string) {
    this.start = start;
    this.text = text;
  }
}
