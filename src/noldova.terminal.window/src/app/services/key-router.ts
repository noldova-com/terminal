/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../../resources.ts";

export class KeyRouter {
  private readonly isMac: boolean;
  private readonly isWindows: boolean;

  public constructor(isMac: boolean, isWindows: boolean) {
    this.isMac = isMac;
    this.isWindows = isWindows;
  }

  public isForShell(event: KeyboardEvent, hasSelection: boolean, windowCommand: string | null): boolean {
    if (windowCommand?.startsWith(Resources.commandPrefix) === true)
      return false;
    if (this.isMac)
      return !event.metaKey;
    if (event.ctrlKey && event.shiftKey)
      return false;
    return !(this.isWindows && hasSelection && event.ctrlKey && !event.altKey && event.key.toLowerCase() === Resources.copyKey);
  }

  public isCopy(event: KeyboardEvent, hasSelection: boolean): boolean {
    if (event.key.toLowerCase() !== Resources.copyKey || event.altKey)
      return false;
    if (this.isMac)
      return event.metaKey && !event.ctrlKey && !event.shiftKey;
    return event.ctrlKey && (event.shiftKey || (this.isWindows && hasSelection));
  }
}
