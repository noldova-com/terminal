/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class ArgumentProblem {
  public readonly parameterName: string;
  public readonly reason: string;
  public readonly message: string;

  public constructor(parameterName: string, reason: string, message: string) {
    this.parameterName = parameterName;
    this.reason = reason;
    this.message = message;
  }
}
