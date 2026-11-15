/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../../resources.ts";

export class LinkPolicy {
  public static isAllowed(url: string): boolean {
    return URL.canParse(url) && Resources.allowedLinkProtocols.includes(new URL(url).protocol);
  }

  public static isOpening(event: MouseEvent, isMac: boolean): boolean {
    return event.button === Resources.linkOpeningButton && (isMac ? event.metaKey : event.ctrlKey);
  }
}
