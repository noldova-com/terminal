/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import { EscapeState } from "../enums/escape-state.ts";
import { Resources } from "../resources.ts";

export class EscapeSequenceTracker {
  private state: EscapeState = EscapeState.Ground;
  private parts: string[] = [];
  private length: number = 0;
  private isOverflowed: boolean = false;

  public get pending(): string {
    return this.isOverflowed ? "" : this.parts.join("");
  }

  public track(data: string): void {
    let start: number = this.state === EscapeState.Ground ? -1 : 0;
    for (let index: number = this.findNext(data, 0); index < data.length; index = this.findNext(data, index + 1)) {
      const next: EscapeState = this.advance(data.charCodeAt(index));
      if (next === EscapeState.Ground)
        start = -1;
      else if (this.isIntroducer(data.charCodeAt(index), next)) {
        this.clear();
        start = index;
      }
      this.state = next;
    }
    if (this.state === EscapeState.Ground)
      this.clear();
    else
      this.append(data.slice(start));
  }

  private findNext(data: string, start: number): number {
    const search: RegExp | null = EscapeSequenceTracker.searchOf(this.state);
    if (Object.isNull(search))
      return start;
    search.lastIndex = start;
    return search.exec(data)?.index ?? data.length;
  }

  private advance(code: number): EscapeState {
    if (code === Resources.escapeSequenceTrackerCancel || code === Resources.escapeSequenceTrackerSubstitute)
      return EscapeState.Ground;
    if (code === Resources.escapeSequenceTrackerEscape)
      return EscapeState.Escape;
    switch (this.state) {
      case EscapeState.Ground:
        return EscapeSequenceTracker.introduce(code);
      case EscapeState.Escape:
        return EscapeSequenceTracker.escape(code);
      case EscapeState.EscapeIntermediate:
        return EscapeSequenceTracker.escapeIntermediate(code);
      case EscapeState.ControlSequence:
        return EscapeSequenceTracker.controlSequence(code);
      case EscapeState.OperatingSystemCommand:
      case EscapeState.ControlString:
        return EscapeState.Ground;
    }
  }

  private isIntroducer(code: number, next: EscapeState): boolean {
    return code === Resources.escapeSequenceTrackerEscape || (this.state === EscapeState.Ground && next !== EscapeState.Ground);
  }

  private clear(): void {
    this.parts = [];
    this.length = 0;
    this.isOverflowed = false;
  }

  private append(part: string): void {
    if (this.isOverflowed)
      return;
    this.length += part.length;
    if (this.length > Resources.maximumPendingLength) {
      this.parts = [];
      this.isOverflowed = true;
    }
    else
      this.parts.push(part);
  }

  private static searchOf(state: EscapeState): RegExp | null {
    switch (state) {
      case EscapeState.Ground:
        return Resources.escapeSequenceTrackerIntroducer;
      case EscapeState.OperatingSystemCommand:
        return Resources.escapeSequenceTrackerOperatingSystemCommandStop;
      case EscapeState.ControlString:
        return Resources.escapeSequenceTrackerControlStringStop;
      default:
        return null;
    }
  }

  private static introduce(code: number): EscapeState {
    switch (code) {
      case Resources.escapeSequenceTrackerControlSequenceIntroducer:
        return EscapeState.ControlSequence;
      case Resources.escapeSequenceTrackerOperatingSystemCommand:
        return EscapeState.OperatingSystemCommand;
      default:
        return EscapeState.ControlString;
    }
  }

  private static escape(code: number): EscapeState {
    switch (code) {
      case Resources.escapeSequenceTrackerOpenBracket:
        return EscapeState.ControlSequence;
      case Resources.escapeSequenceTrackerCloseBracket:
        return EscapeState.OperatingSystemCommand;
      case Resources.escapeSequenceTrackerLetterP:
      case Resources.escapeSequenceTrackerLetterX:
      case Resources.escapeSequenceTrackerCaret:
      case Resources.escapeSequenceTrackerUnderscore:
        return EscapeState.ControlString;
      default:
        break;
    }
    if (code < Resources.escapeSequenceTrackerSpace || code === Resources.escapeSequenceTrackerDelete)
      return EscapeState.Escape;
    return code <= Resources.escapeSequenceTrackerLastIntermediate ? EscapeState.EscapeIntermediate : EscapeState.Ground;
  }

  private static escapeIntermediate(code: number): EscapeState {
    return code <= Resources.escapeSequenceTrackerLastIntermediate || code === Resources.escapeSequenceTrackerDelete ? EscapeState.EscapeIntermediate : EscapeState.Ground;
  }

  private static controlSequence(code: number): EscapeState {
    return code < Resources.escapeSequenceTrackerFirstControlSequenceFinal || code === Resources.escapeSequenceTrackerDelete ? EscapeState.ControlSequence : EscapeState.Ground;
  }
}
