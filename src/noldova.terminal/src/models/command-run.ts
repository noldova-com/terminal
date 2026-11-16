/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class CommandRun {
  public readonly answer: Promise<string>;
  public readonly ended: Promise<void>;

  public constructor(answer: Promise<string>, ended: Promise<void>) {
    this.answer = answer;
    this.ended = ended;
  }
}
