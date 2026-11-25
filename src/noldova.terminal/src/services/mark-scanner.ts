/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import { MarkKind } from "../enums/mark-kind.ts";
import { ShellMark } from "../models/shell-mark.ts";
import { Resources } from "../resources.ts";

const INTRODUCERS: readonly string[] = [Resources.markIntroducer, Resources.eightBitMarkIntroducer];
const LONGEST_INTRODUCER: number = Math.max(...INTRODUCERS.map(t => t.length));
const TERMINATORS: readonly string[] = [Resources.bell, Resources.eightBitStringTerminator];
const CANCELS: readonly string[] = [Resources.cancel, Resources.substitute];

export class MarkScanner {
  private readonly nonce: string;
  private carry: string = "";

  public constructor(nonce: string) {
    this.nonce = nonce;
  }

  public scan(data: string, offset: number): readonly ShellMark[] {
    const text: string = this.carry + data;
    const textOffset: number = offset - this.carry.length;
    const marks: ShellMark[] = [];
    this.carry = "";
    let index: number = 0;
    while (index < text.length) {
      const [start, introducer] = MarkScanner.findIntroducer(text, index);
      if (start < 0) {
        this.carry = MarkScanner.toIntroducerPrefix(text, index);
        break;
      }
      const payloadStart: number = start + introducer.length;
      const [payloadEnd, end] = MarkScanner.findTerminator(text, payloadStart);
      if (payloadEnd < 0) {
        this.carry = text.length - start <= Resources.maximumMarkLength ? text.slice(start) : MarkScanner.toIntroducerPrefix(text, payloadStart);
        break;
      }
      if (end < 0) {
        index = payloadEnd;
        continue;
      }
      if (end - start > Resources.maximumMarkLength) {
        index = end;
        continue;
      }
      const mark: ShellMark | null = this.parse(text.slice(payloadStart, payloadEnd), textOffset + end);
      if (!Object.isNull(mark))
        marks.push(mark);
      index = end;
    }
    return marks;
  }

  private parse(payload: string, offset: number): ShellMark | null {
    const [kindText, nonce, ...values] = payload.replace(Resources.markScannerIgnoredControl, "").split(Resources.markScannerFieldSeparator);
    const kind: MarkKind | undefined = Resources.markKindLetters.get(String(kindText));
    if (Object.isUndefined(kind) || nonce !== this.nonce)
      return null;
    const fields: readonly string[] = values.map(t => t.replace(Resources.markScannerEscapedCharacter,
      (_, code: string) => String.fromCharCode(Number.parseInt(code, Resources.hexadecimalRadix))));
    return new ShellMark(kind, fields.length === 0 ? null : fields.join(Resources.markScannerFieldSeparator), offset, fields);
  }

  private static findTerminator(text: string, from: number): readonly [number, number] {
    for (let index: number = from; index < text.length; index++) {
      const terminator: string | undefined = TERMINATORS.find(t => text.startsWith(t, index));
      if (!Object.isUndefined(terminator))
        return [index, index + terminator.length];
      if (CANCELS.some(t => text.startsWith(t, index)))
        return [index, -1];
      if (!text.startsWith(Resources.escape, index))
        continue;
      if (index + Resources.escape.length === text.length)
        return [-1, -1];
      return text.startsWith(Resources.stringTerminator, index) ? [index, index + Resources.stringTerminator.length] : [index, -1];
    }
    return [-1, -1];
  }

  private static findIntroducer(text: string, from: number): readonly [number, string] {
    let found: readonly [number, string] = [-1, ""];
    for (const introducer of INTRODUCERS) {
      const start: number = text.indexOf(introducer, from);
      if (start >= 0 && (found[0] < 0 || start < found[0]))
        found = [start, introducer];
    }
    return found;
  }

  private static toIntroducerPrefix(text: string, from: number): string {
    for (let length: number = Math.min(LONGEST_INTRODUCER - 1, text.length - from); length > 0; length--) {
      const prefix: string = text.slice(text.length - length);
      if (INTRODUCERS.some(t => t.startsWith(prefix)))
        return prefix;
    }
    return "";
  }
}
