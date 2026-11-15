/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { TerminalSize } from "@noldova/terminal.protocol";

export interface ISizedPane {
  isShown(): boolean;
  hasFocus(): boolean;
  follow(size: TerminalSize): void;
  lead(): void;
}
