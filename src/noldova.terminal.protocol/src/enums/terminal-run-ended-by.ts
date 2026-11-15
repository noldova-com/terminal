/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export const TerminalRunEndedBy = {
  Command: "Command",
  NoIntegration: "NoIntegration",
  TerminalEnded: "TerminalEnded"
} as const;

export type TerminalRunEndedBy = (typeof TerminalRunEndedBy)[keyof typeof TerminalRunEndedBy];
