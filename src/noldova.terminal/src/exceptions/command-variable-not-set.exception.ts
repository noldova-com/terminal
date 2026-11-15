/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../resources.ts";
import { CommandFailedException } from "./command-failed.exception.ts";

export class CommandVariableNotSetException extends CommandFailedException {
  public readonly command: string;
  public readonly variable: string;

  public constructor(command: string, variable: string) {
    super(Resources.formatCommandVariableNotSet(command, variable));

    this.command = command;
    this.variable = variable;
  }
}
