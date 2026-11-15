/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export const TerminalTextStyle = {
  Bold: 1,
  Dim: 2,
  Italic: 4,
  Underline: 8,
  Blink: 16,
  Inverse: 32,
  Invisible: 64,
  Strikethrough: 128,
  Overline: 256
} as const;

export type TerminalTextStyle = (typeof TerminalTextStyle)[keyof typeof TerminalTextStyle];
