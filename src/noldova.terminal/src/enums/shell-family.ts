/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export const ShellFamily = {
  Bash: "Bash",
  Zsh: "Zsh",
  PowerShell: "PowerShell",
  CommandPrompt: "CommandPrompt",
  Other: "Other"
} as const;

export type ShellFamily = (typeof ShellFamily)[keyof typeof ShellFamily];
