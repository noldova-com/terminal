/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export const TerminalRunOutcome = {
  Typed: "Typed",
  Input: "Input",
  Tab: "Tab",
  Ended: "Ended",
  NoShell: "NoShell",
  Busy: "Busy"
} as const;

export type TerminalRunOutcome = (typeof TerminalRunOutcome)[keyof typeof TerminalRunOutcome];
