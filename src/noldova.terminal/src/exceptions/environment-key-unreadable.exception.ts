/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ExceptionOptions } from "@noldova/context.exceptions";

import { Resources } from "../resources.ts";
import { EnvironmentUnreadableException } from "./environment-unreadable.exception.ts";

export class EnvironmentKeyUnreadableException extends EnvironmentUnreadableException {
  public readonly key: string;

  public constructor(key: string, cause: unknown) {
    super(Resources.formatEnvironmentKeyUnread(key), new ExceptionOptions(cause));

    this.key = key;
  }
}
