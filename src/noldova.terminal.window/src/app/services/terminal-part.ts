/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IWindowPartContext } from "@noldova/desktop.window";

export class TerminalPart {
  private static active: IWindowPartContext | null = null;

  public static get context(): IWindowPartContext | null {
    return TerminalPart.active;
  }

  public static serve(part: IWindowPartContext): () => void {
    TerminalPart.active = part;
    return () => {
      if (TerminalPart.active === part)
        TerminalPart.active = null;
    };
  }
}
