/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ToolAbortReason, ToolFailure, ToolFailureCode, ToolFailureException, type ToolResult } from "@noldova/desktop.runtime";

import { Resources } from "../../resources.ts";
import { AbortReasonReader } from "./abort-reason-reader.ts";

export class ToolFailures {
  private static readonly endedCodes: Readonly<Record<ToolAbortReason, ToolFailureCode>> = {
    [ToolAbortReason.Stopped]: ToolFailureCode.Stopped,
    [ToolAbortReason.Cancelled]: ToolFailureCode.Cancelled,
    [ToolAbortReason.SessionEnded]: ToolFailureCode.Cancelled,
    [ToolAbortReason.SwitchedOff]: ToolFailureCode.Unavailable,
    [ToolAbortReason.DeadlineReached]: ToolFailureCode.TimedOut
  };

  public static create(code: ToolFailureCode, moduleCode: string | null, message: string, output: ToolResult | null = null): ToolFailureException {
    return new ToolFailureException(new ToolFailure(code, message, moduleCode, output?.content ?? []));
  }

  public static forEndedCall(signal: AbortSignal, message: string, output: ToolResult | null = null): ToolFailureException {
    return ToolFailures.create(ToolFailures.endedCodes[AbortReasonReader.readReason(signal)], null, message, output);
  }

  public static forUncertainOutcome(message: string): ToolFailureException {
    return ToolFailures.create(ToolFailureCode.OutcomeUncertain, Resources.uncertainCode, message);
  }
}
