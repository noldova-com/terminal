/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ShellLine } from "../models/shell-line.ts";
import { Resources } from "../resources.ts";

export class ShellWords {
  public static read(text: string, isPowerShell: boolean): ShellLine {
    const escape: string = isPowerShell ? Resources.powerShellEscape : Resources.posixEscape;
    let words: string[] = [];
    let value: string = "";
    let start: number = text.length;
    let isInWord: boolean = false;
    let quote: string | null = null;
    let startsQuoted: boolean = false;
    for (let index: number = 0; index < text.length; index++) {
      const character: string = text.charAt(index);
      if (quote === Resources.singleQuote) {
        if (character !== Resources.singleQuote)
          value += character;
        else if (isPowerShell && text.charAt(index + 1) === Resources.singleQuote) {
          value += character;
          index++;
        }
        else
          quote = null;
        continue;
      }
      if (!isInWord && !Resources.wordBreaks.includes(character) && !Resources.commandBreaks.includes(character)) {
        isInWord = true;
        start = index;
        startsQuoted = character === escape || character === Resources.singleQuote || character === Resources.doubleQuote;
      }
      if (character === escape && index + 1 < text.length) {
        const next: string = text.charAt(index + 1);
        if (quote === null || isPowerShell || Resources.posixQuotedEscapes.includes(next)) {
          value += next;
          index++;
        }
        else
          value += character;
      }
      else if (quote === Resources.doubleQuote) {
        if (character === Resources.doubleQuote)
          quote = null;
        else
          value += character;
      }
      else if (character === Resources.singleQuote || character === Resources.doubleQuote)
        quote = character;
      else if (Resources.wordBreaks.includes(character)) {
        if (isInWord)
          words.push(value);
        value = "";
        isInWord = false;
      }
      else if (Resources.commandBreaks.includes(character)) {
        words = [];
        value = "";
        isInWord = false;
      }
      else
        value += character;
    }
    return new ShellLine(words, isInWord ? start : text.length, value, quote, isInWord && startsQuoted);
  }

  public static write(value: string, quote: string | null, isPowerShell: boolean, closesQuote: boolean, escapesWildcards: boolean,
    keepsHome: boolean): string {
    const literal: string = isPowerShell && escapesWildcards ? value.replace(Resources.powerShellWildcards, Resources.shellWordsPowerShellEscapeReplacement) : value;
    const quoted: string | null = quote ?? (isPowerShell && (literal !== value || Resources.powerShellSpecial.test(value)) ? Resources.singleQuote : null);
    if (quoted === null)
      return isPowerShell ? literal : `${!keepsHome && value.startsWith(Resources.homeWord) ? Resources.posixEscape : ""}${value.replace(Resources.posixSpecial,
        Resources.shellWordsPosixEscapeReplacement)}`;
    const body: string = quoted === Resources.singleQuote
      ? literal.replaceAll(Resources.singleQuote, isPowerShell ? Resources.shellWordsPowerShellQuotedSingleQuote : Resources.shellWordsPosixQuotedSingleQuote)
      : literal.replace(isPowerShell ? Resources.powerShellQuotedSpecial : Resources.posixQuotedSpecial,
        isPowerShell ? Resources.shellWordsPowerShellEscapeReplacement : Resources.shellWordsPosixEscapeReplacement);
    return `${quoted}${body}${closesQuote ? quoted : ""}`;
  }
}
