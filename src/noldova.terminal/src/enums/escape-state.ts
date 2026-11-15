/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export const EscapeState = {
  Ground: "Ground",
  Escape: "Escape",
  EscapeIntermediate: "EscapeIntermediate",
  ControlSequence: "ControlSequence",
  OperatingSystemCommand: "OperatingSystemCommand",
  ControlString: "ControlString"
} as const;

export type EscapeState = (typeof EscapeState)[keyof typeof EscapeState];
