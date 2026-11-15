/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export const TerminalShellKind = {
  PowerShell: "PowerShell",
  CommandPrompt: "CommandPrompt",
  Bash: "Bash",
  Zsh: "Zsh",
  Fish: "Fish",
  Wsl: "Wsl",
  Other: "Other"
} as const;

export type TerminalShellKind = (typeof TerminalShellKind)[keyof typeof TerminalShellKind];
