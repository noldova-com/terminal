/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../../resources.ts";

export class PasteFilter {
  public static clean(text: string): string {
    return text.replaceAll(Resources.escape, "");
  }
}
