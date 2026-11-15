/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export interface ITerminalFocusTarget {
  contains(element: Element | null): boolean;
  isFor(sessionId: string): boolean;
  showAsync(): Promise<boolean>;
  hideDock(): void;
}
