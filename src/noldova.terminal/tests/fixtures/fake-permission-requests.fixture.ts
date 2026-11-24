/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import { Fake } from "@noldova/desktop.protocol/testing";
import { type IPermissionAnswerer, type IPermissionRequest, type IToolCallPermissions, PermissionDecision, PermissionOutcome,
  type PermissionQuestion } from "@noldova/desktop.runtime";

export class FakePermissionRequests extends Fake<IToolCallPermissions & IPermissionAnswerer> implements IToolCallPermissions, IPermissionAnswerer {
  public readonly requests: IPermissionRequest[] = [];
  public readonly questions: PermissionQuestion[] = [];
  public readonly requestAsync: IToolCallPermissions["requestAsync"] = (...args) =>
    this.respondAsync("requestAsync", args, this.answers.requestAsync ?? this.decideAsync);
  public readonly answerAsync: IPermissionAnswerer["answerAsync"] = (...args) =>
    this.respondAsync("answerAsync", args, this.answers.answerAsync ?? this.answerQuestionAsync);
  private readonly decisions: (PermissionDecision | Promise<PermissionDecision>)[] = [];
  private onRaised: (() => void) | null = null;
  private readonly decideAsync = async (request: IPermissionRequest, signal: AbortSignal): Promise<PermissionOutcome> => {
    this.requests.push(request);
    this.onRaised?.();
    const decision: PermissionDecision | Promise<PermissionDecision> | undefined = this.decisions.shift();
    if (!Object.isUndefined(decision))
      return new PermissionOutcome(await decision);
    if (signal.aborted)
      return new PermissionOutcome(PermissionDecision.Withdrawn);
    return await new Promise<PermissionOutcome>(t => signal.addEventListener("abort", () => t(new PermissionOutcome(PermissionDecision.Withdrawn)), { once: true }));
  };
  private readonly answerQuestionAsync = async (question: PermissionQuestion, signal: AbortSignal): Promise<PermissionDecision> => {
    this.questions.push(question);
    return (await this.requestAsync(question.request, signal)).decision;
  };

  public answerNext(...decisions: readonly (PermissionDecision | Promise<PermissionDecision>)[]): void {
    this.decisions.push(...decisions);
  }

  public whenRaised(action: () => void): void {
    this.onRaised = action;
  }

  public detail(index: number, label: string): string | undefined {
    const values: readonly string[] = (this.requests[index]?.details ?? []).filter(t => t.label === label).map(t => t.value);
    return values.length === 1 ? values[0] : undefined;
  }
}
