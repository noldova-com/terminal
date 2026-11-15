/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ToolAbortReason } from "@noldova/desktop.runtime";

import { AbortReasonUnknownException } from "../exceptions/abort-reason-unknown.exception.ts";

export class AbortReasonReader {
  private static readonly reasons: ReadonlySet<unknown> = new Set<unknown>(Object.values(ToolAbortReason));

  public static readReason(signal: AbortSignal): ToolAbortReason {
    const reason: unknown = signal.reason;
    if (!AbortReasonReader.isReason(reason))
      throw new AbortReasonUnknownException(reason);
    return reason;
  }

  public static interruptsCommand(signal: AbortSignal): boolean {
    const reason: ToolAbortReason = AbortReasonReader.readReason(signal);
    return reason === ToolAbortReason.Stopped || reason === ToolAbortReason.Cancelled || reason === ToolAbortReason.SessionEnded;
  }

  private static isReason(value: unknown): value is ToolAbortReason {
    return AbortReasonReader.reasons.has(value);
  }
}
