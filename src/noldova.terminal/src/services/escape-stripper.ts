/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { EscapeStripperState } from "../enums/escape-stripper-state.ts";
import { Resources } from "../resources.ts";

export class EscapeStripper {
  private state: EscapeStripperState = EscapeStripperState.Ground;
  private hasCarriageReturn: boolean = false;

  public strip(data: string): string {
    let text: string = "";
    let index: number = 0;
    while (index < data.length) {
      if (this.state === EscapeStripperState.Ground) {
        const end: number = EscapeStripper.findSpecial(data, index);
        if (end > index) {
          text += (this.hasCarriageReturn ? Resources.lineFeed : "") + data.slice(index, end);
          this.hasCarriageReturn = false;
          index = end;
          continue;
        }
        const silentEnd: number = EscapeStripper.findSilentEnd(data, index);
        if (silentEnd > index) {
          this.hasCarriageReturn ||= data.slice(index, silentEnd).includes(Resources.carriageReturn);
          index = silentEnd;
          continue;
        }
      }
      text += this.read(data.charAt(index), data.charCodeAt(index));
      index++;
    }
    return text;
  }

  private read(character: string, code: number): string {
    switch (this.state) {
      case EscapeStripperState.Ground:
        return this.readControl(code);
      case EscapeStripperState.Escape:
        this.state = EscapeStripper.afterEscape(character, code);
        break;
      case EscapeStripperState.Intermediate:
        if (code < Resources.escapeStripperFirstIntermediate || code > Resources.escapeStripperLastIntermediate)
          this.state = EscapeStripperState.Ground;
        break;
      case EscapeStripperState.Control:
        if (code === Resources.escapeStripperEscape)
          this.state = EscapeStripperState.Escape;
        else if (code >= Resources.escapeStripperFirstControlSequenceFinal && code <= Resources.escapeStripperLastControlSequenceFinal)
          this.state = EscapeStripperState.Ground;
        break;
      case EscapeStripperState.String:
        if (code === Resources.escapeStripperBell)
          this.state = EscapeStripperState.Ground;
        else if (code === Resources.escapeStripperEscape)
          this.state = EscapeStripperState.StringEscape;
        break;
      case EscapeStripperState.StringEscape:
        this.state = character === Resources.escapeStripperStringTerminatorFinal ? EscapeStripperState.Ground : EscapeStripperState.String;
        break;
    }
    return "";
  }

  private readControl(code: number): string {
    if (code === Resources.escapeStripperEscape) {
      this.state = EscapeStripperState.Escape;
      return "";
    }
    this.hasCarriageReturn = false;
    return Resources.lineFeed;
  }

  private static findSpecial(data: string, start: number): number {
    Resources.escapeStripperSpecial.lastIndex = start;
    return Resources.escapeStripperSpecial.exec(data)?.index ?? data.length;
  }

  private static findSilentEnd(data: string, start: number): number {
    Resources.escapeStripperSilent.lastIndex = start;
    return Resources.escapeStripperSilent.test(data) ? Resources.escapeStripperSilent.lastIndex : start;
  }

  private static afterEscape(character: string, code: number): EscapeStripperState {
    if (character === Resources.escapeStripperControlSequenceIntroducer)
      return EscapeStripperState.Control;
    if (character === Resources.escapeStripperOperatingSystemCommandIntroducer || character === Resources.escapeStripperDeviceControlIntroducer
      || character === Resources.escapeStripperStartOfStringIntroducer || character === Resources.escapeStripperPrivacyMessageIntroducer
      || character === Resources.escapeStripperApplicationCommandIntroducer)
      return EscapeStripperState.String;
    return code >= Resources.escapeStripperFirstIntermediate && code <= Resources.escapeStripperLastIntermediate ? EscapeStripperState.Intermediate : EscapeStripperState.Ground;
  }
}
