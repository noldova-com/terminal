/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ShellOptionsReply } from "../models/shell-options-reply.ts";

export interface IWaitingOptionsRequest {
  settle: ((reply: ShellOptionsReply) => void) | null;
}
