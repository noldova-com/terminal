/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class ShellOptionsReply {
  public static readonly none: ShellOptionsReply = new ShellOptionsReply(null, false);
  public static readonly timedOut: ShellOptionsReply = new ShellOptionsReply(null, true);

  public readonly options: readonly string[] | null;
  public readonly isTimedOut: boolean;

  public constructor(options: readonly string[] | null, isTimedOut: boolean) {
    this.options = options;
    this.isTimedOut = isTimedOut;
  }
}
