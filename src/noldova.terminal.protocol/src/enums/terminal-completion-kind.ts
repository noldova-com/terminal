/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export const TerminalCompletionKind = {
  File: "File",
  Folder: "Folder",
  Command: "Command",
  Branch: "Branch",
  Script: "Script",
  Option: "Option"
} as const;

export type TerminalCompletionKind = (typeof TerminalCompletionKind)[keyof typeof TerminalCompletionKind];
