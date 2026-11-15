/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export const EscapeStripperState = {
  Ground: "Ground",
  Escape: "Escape",
  Intermediate: "Intermediate",
  Control: "Control",
  String: "String",
  StringEscape: "StringEscape"
} as const;

export type EscapeStripperState = (typeof EscapeStripperState)[keyof typeof EscapeStripperState];
