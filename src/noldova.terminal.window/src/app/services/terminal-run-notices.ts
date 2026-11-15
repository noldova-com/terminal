/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class TerminalRunNotices {
  private static listener: ((sessionId: string) => void) | null = null;

  public static listen(listener: (sessionId: string) => void): () => void {
    TerminalRunNotices.listener = listener;
    return () => {
      if (TerminalRunNotices.listener === listener)
        TerminalRunNotices.listener = null;
    };
  }

  public static notice(sessionId: string): void {
    TerminalRunNotices.listener?.(sessionId);
  }
}
