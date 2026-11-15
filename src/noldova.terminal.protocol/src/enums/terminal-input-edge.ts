/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export const TerminalInputEdge = {
  Start: "Start",
  End: "End",
  RightPrompt: "RightPrompt",
  Continuation: "Continuation"
} as const;

export type TerminalInputEdge = (typeof TerminalInputEdge)[keyof typeof TerminalInputEdge];
