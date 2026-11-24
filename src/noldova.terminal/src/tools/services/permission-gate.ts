/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import { PermissionDecision, type PermissionOutcome, ToolFailureCode } from "@noldova/desktop.runtime";

import { Resources } from "../../resources.ts";
import type { PermissionAsk } from "../models/permission-ask.ts";
import type { ToolCallContext } from "../models/tool-call-context.ts";
import { ToolFailures } from "./tool-failures.ts";

export class PermissionGate {
  private static readonly failures: Readonly<Record<PermissionDecision, ToolFailureCode | null>> = {
    [PermissionDecision.AllowedOnce]: null,
    [PermissionDecision.AllowedAlways]: null,
    [PermissionDecision.Denied]: ToolFailureCode.Denied,
    [PermissionDecision.DeniedAlways]: ToolFailureCode.Denied,
    [PermissionDecision.Expired]: ToolFailureCode.Expired,
    [PermissionDecision.Withdrawn]: ToolFailureCode.Withdrawn,
    [PermissionDecision.TakenOver]: ToolFailureCode.Denied
  };

  public async requireGrantAsync(ask: PermissionAsk, context: ToolCallContext): Promise<void> {
    PermissionGate.requireOpenCall(ask, context);
    if (Buffer.byteLength(JSON.stringify(ask.request.details), Resources.utf8Encoding) > Resources.maximumPermissionDetailBytes)
      throw ToolFailures.create(ToolFailureCode.Refused, Resources.requestTooLargeCode, Resources.formatRequestTooLarge(ask.toolName));
    const outcome: PermissionOutcome = await context.requestPermissionAsync(ask.request);
    const failure: ToolFailureCode | null = PermissionGate.failures[outcome.decision];
    if (!Object.isNull(failure))
      throw ToolFailures.create(failure, null, Resources.formatNotGranted(ask.toolName, outcome.decision));
    PermissionGate.requireOpenCall(ask, context);
  }

  private static requireOpenCall(ask: PermissionAsk, context: ToolCallContext): void {
    if (context.signal.aborted)
      throw ToolFailures.forEndedCall(context.signal, Resources.formatCancelled(ask.toolName));
  }
}
