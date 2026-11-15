/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { createRequire } from "node:module";

import type * as XtermHeadless from "@xterm/headless";

export class XtermHeadlessLoader {
  private static readonly module: typeof XtermHeadless = createRequire(import.meta.url)("@xterm/headless");

  public static createTerminal(options: XtermHeadless.ITerminalOptions & XtermHeadless.ITerminalInitOnlyOptions): XtermHeadless.Terminal {
    return new XtermHeadlessLoader.module.Terminal(options);
  }
}
