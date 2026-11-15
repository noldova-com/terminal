/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export const EndedBy = {
  Exit: "Exit",
  Close: "Close"
} as const;

export type EndedBy = (typeof EndedBy)[keyof typeof EndedBy];
