/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export const TerminalRunBusy = {
  Refuse: "Refuse",
  Interrupt: "Interrupt"
} as const;

export type TerminalRunBusy = (typeof TerminalRunBusy)[keyof typeof TerminalRunBusy];
