/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export const CommandStatus = {
  Running: "Running",
  AwaitingInput: "AwaitingInput",
  Exited: "Exited",
  Killed: "Killed"
} as const;

export type CommandStatus = (typeof CommandStatus)[keyof typeof CommandStatus];
