/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import { Resources } from "../../resources.ts";
import { CommandTokenKind } from "../enums/command-token-kind.ts";
import { CommandToken } from "../models/command-token.ts";
import { HereDocument } from "../models/here-document.ts";

export class CommandLineTokens {
  public static read(text: string, isPowerShell: boolean, isZsh: boolean): readonly CommandToken[] {
    const kinds: (CommandTokenKind | null)[] = Array.from({ length: text.length }, () => null);
    const operators: string = isPowerShell ? Resources.powerShellOperators : Resources.posixOperators;
    const joinedBreak: string = (isPowerShell ? Resources.powerShellEscape : Resources.posixEscape) + Resources.commandLineBreak;
    const delimiters: HereDocument[] = [];
    let expectsCommand: boolean = true;
    let afterBlock: boolean = false;
    let expectsDelimiter: boolean = false;
    let afterModifier: boolean = false;
    let modifier: string | null = null;
    let expectsOptionValue: boolean = false;
    let expectsTarget: boolean = false;
    let inLoopNames: boolean = false;
    let inLoopWords: boolean = false;
    let afterBrace: boolean = false;
    let afterRepeat: boolean = false;
    const modifiers: readonly string[] = isPowerShell ? []
      : isZsh ? [...Resources.posixPrecommandModifiers, ...Resources.zshPrecommandModifiers] : Resources.posixPrecommandModifiers;
    let index: number = 0;
    while (index < text.length) {
      const character: string = text.charAt(index);
      if (Resources.commandBlanks.includes(character))
        index++;
      else if (text.startsWith(joinedBreak, index))
        index += joinedBreak.length;
      else if (character === Resources.commandLineBreak) {
        expectsCommand = true;
        afterBlock = false;
        afterModifier = false;
        expectsOptionValue = false;
        expectsTarget = false;
        afterRepeat = false;
        inLoopNames = false;
        index = CommandLineTokens.readHereDocuments(text, index + 1, delimiters, kinds);
      }
      else if (!isZsh && character === Resources.commentStart) {
        const lineEnd: number = text.indexOf(Resources.commandLineBreak, index);
        const end: number = lineEnd === -1 ? text.length : lineEnd;
        CommandLineTokens.fill(kinds, index, end, CommandTokenKind.Comment);
        index = end;
      }
      else if (text.startsWith(Resources.subexpressionStart, index)) {
        CommandLineTokens.fill(kinds, index, index + Resources.subexpressionStart.length, CommandTokenKind.Operator);
        expectsCommand = true;
        afterModifier = false;
        index += Resources.subexpressionStart.length;
      }
      else if (operators.includes(character) || CommandLineTokens.matchAt(Resources.redirectionStartPattern, text, index) > 0) {
        const end: number = isZsh && text.startsWith(Resources.zshDisownOperator, index) ? index + Resources.zshDisownOperator.length
          : CommandLineTokens.findOperatorEnd(text, index, operators);
        const operator: string = text.slice(index, end);
        CommandLineTokens.fill(kinds, index, end, CommandTokenKind.Operator);
        if (!Resources.redirectionPattern.test(operator))
          expectsCommand = Resources.commandOpeningPattern.test(operator);
        afterBlock = isPowerShell && operator.endsWith(Resources.blockEnd);
        expectsDelimiter = !isPowerShell && operator.endsWith(Resources.hereDocumentOperator) && !operator.endsWith(Resources.hereStringOperator);
        expectsTarget = !isPowerShell && !expectsDelimiter && Resources.redirectionPattern.test(operator) && Resources.targetedRedirectionPattern.test(operator);
        if (inLoopNames && operator === Resources.listStart) {
          inLoopWords = true;
          expectsCommand = false;
        }
        else if (inLoopWords && operator.startsWith(Resources.listEnd)) {
          inLoopWords = false;
          expectsCommand = true;
        }
        afterModifier = afterModifier && expectsTarget;
        afterRepeat = false;
        inLoopNames = false;
        afterBrace = false;
        index = end;
      }
      else {
        const end: number = CommandLineTokens.readWord(text, index, isPowerShell, operators, kinds);
        const word: string = text.slice(index, end);
        if (expectsDelimiter) {
          const isIndented: boolean = word.startsWith(Resources.hereDocumentTabsOption);
          const delimiter: string = isIndented ? word.slice(Resources.hereDocumentTabsOption.length) : word;
          delimiters.push(new HereDocument(delimiter.replace(Resources.delimiterQuotingPattern, ""), isIndented));
          expectsDelimiter = false;
        }
        else if (expectsTarget || expectsOptionValue)
          CommandLineTokens.markWord(word, index, isPowerShell, isZsh, false, kinds);
        else if (afterBlock && Resources.powerShellKeywords.includes(word.toLowerCase())) {
          CommandLineTokens.fill(kinds, index, end, CommandTokenKind.Keyword);
          expectsCommand = false;
        }
        else if (afterBrace && word === Resources.zshAlwaysKeyword) {
          CommandLineTokens.fill(kinds, index, end, CommandTokenKind.Keyword);
          expectsCommand = true;
        }
        else if (expectsCommand && modifiers.includes(word)) {
          CommandLineTokens.fill(kinds, index, end, CommandTokenKind.Keyword);
          afterModifier = true;
          modifier = word;
        }
        else if (afterModifier && word.length > 1 && word.startsWith(Resources.optionStart))
          CommandLineTokens.fill(kinds, index, end, CommandTokenKind.Option);
        else {
          const startsLoop: boolean = isZsh && expectsCommand && Resources.zshLoopKeywords.includes(word);
          const startsRepeat: boolean = isZsh && expectsCommand && word === Resources.zshRepeatKeyword;
          expectsCommand = CommandLineTokens.markWord(word, index, isPowerShell, isZsh, expectsCommand, kinds) || afterRepeat;
          afterModifier = false;
          afterRepeat = startsRepeat;
          inLoopNames = startsLoop || inLoopNames && word !== Resources.loopListKeyword;
        }
        expectsOptionValue = !expectsTarget && !expectsOptionValue && afterModifier && !Object.isNull(modifier)
          && Resources.precommandValueOptions.get(modifier)?.includes(word) === true;
        expectsTarget = false;
        afterBrace = isZsh && word === Resources.blockEnd;
        afterBlock = false;
        index = end;
      }
    }
    return CommandLineTokens.collect(kinds);
  }

  private static readHereDocuments(text: string, start: number, delimiters: HereDocument[], kinds: (CommandTokenKind | null)[]): number {
    if (delimiters.length === 0)
      return start;
    let lineStart: number = start;
    for (let open: HereDocument | undefined = delimiters[0]; !Object.isUndefined(open) && lineStart < text.length; open = delimiters[0]) {
      const found: number = text.indexOf(Resources.commandLineBreak, lineStart);
      const lineEnd: number = found === -1 ? text.length : found;
      const line: string = text.slice(lineStart, lineEnd);
      if ((open.stripsTabs ? line.replace(Resources.hereDocumentIndentPattern, "") : line) === open.delimiter)
        delimiters.shift();
      lineStart = lineEnd + 1;
    }
    const end: number = Math.min(lineStart - 1, text.length);
    CommandLineTokens.fill(kinds, start, end, CommandTokenKind.String);
    return Math.max(end, start);
  }

  private static findOperatorEnd(text: string, start: number, operators: string): number {
    let end: number = start + CommandLineTokens.matchAt(Resources.redirectionStartPattern, text, start);
    while (end < text.length && operators.includes(text.charAt(end)))
      end++;
    const operator: string = text.slice(start, end);
    return operator.endsWith(Resources.duplicateOutputOperator) || operator.endsWith(Resources.duplicateInputOperator)
      ? end + CommandLineTokens.matchAt(Resources.duplicatedStreamPattern, text, end) : end;
  }

  private static readWord(text: string, start: number, isPowerShell: boolean, operators: string, kinds: (CommandTokenKind | null)[]): number {
    const escape: string = isPowerShell ? Resources.powerShellEscape : Resources.posixEscape;
    const variable: RegExp = isPowerShell ? Resources.powerShellVariablePattern : Resources.posixVariablePattern;
    let index: number = start;
    while (index < text.length) {
      const character: string = text.charAt(index);
      if (Resources.commandBlanks.includes(character) || operators.includes(character) || character === Resources.commandLineBreak
        || character === escape && text.charAt(index + 1) === Resources.commandLineBreak || index > start && text.startsWith(Resources.subexpressionStart, index))
        break;
      if (character === escape)
        index += 2;
      else if (character === Resources.singleQuote)
        index = CommandLineTokens.readSingleQuoted(text, index, isPowerShell, kinds);
      else if (character === Resources.doubleQuote)
        index = CommandLineTokens.readDoubleQuoted(text, index, escape, variable, isPowerShell, kinds);
      else {
        const length: number = character === Resources.variableStart ? CommandLineTokens.matchAt(variable, text, index) : 0;
        CommandLineTokens.fill(kinds, index, index + length, CommandTokenKind.Variable);
        index += Math.max(length, 1);
      }
    }
    return Math.min(index, text.length);
  }

  private static readSingleQuoted(text: string, start: number, isPowerShell: boolean, kinds: (CommandTokenKind | null)[]): number {
    let end: number = start + 1;
    while (end < text.length) {
      if (text.charAt(end) !== Resources.singleQuote)
        end++;
      else if (isPowerShell && text.charAt(end + 1) === Resources.singleQuote)
        end += 2;
      else {
        end++;
        break;
      }
    }
    const closed: number = Math.min(end, text.length);
    CommandLineTokens.fill(kinds, start, closed, CommandTokenKind.String);
    return closed;
  }

  private static readDoubleQuoted(text: string, start: number, escape: string, variable: RegExp, isPowerShell: boolean,
    kinds: (CommandTokenKind | null)[]): number {
    let end: number = start + 1;
    while (end < text.length) {
      const character: string = text.charAt(end);
      if (character === escape)
        end += 2;
      else if (character === Resources.doubleQuote && isPowerShell && text.charAt(end + 1) === Resources.doubleQuote)
        end += 2;
      else if (character === Resources.doubleQuote) {
        end++;
        break;
      }
      else {
        const length: number = character === Resources.variableStart ? CommandLineTokens.matchAt(variable, text, end) : 0;
        CommandLineTokens.fill(kinds, end, end + length, CommandTokenKind.Variable);
        end += Math.max(length, 1);
      }
    }
    const closed: number = Math.min(end, text.length);
    CommandLineTokens.fill(kinds, start, closed, CommandTokenKind.String);
    return closed;
  }

  private static markWord(word: string, start: number, isPowerShell: boolean, isZsh: boolean, expectsCommand: boolean,
    kinds: (CommandTokenKind | null)[]): boolean {
    const end: number = start + word.length;
    if (isZsh && Resources.zshEqualsPattern.test(word)) {
      CommandLineTokens.fill(kinds, start, end, CommandTokenKind.Path);
      return false;
    }
    if (isZsh && word === Resources.blockEnd) {
      CommandLineTokens.fill(kinds, start, end, CommandTokenKind.Keyword);
      return false;
    }
    if (expectsCommand) {
      if (!isPowerShell && Resources.posixAssignmentPattern.test(word))
        return true;
      if (isPowerShell && word.startsWith(Resources.variableStart))
        return false;
      if (isPowerShell ? Resources.powerShellKeywords.includes(word.toLowerCase())
        : Resources.posixKeywords.includes(word) || isZsh && Resources.zshKeywords.includes(word)) {
        CommandLineTokens.fill(kinds, start, end, CommandTokenKind.Keyword);
        return !isPowerShell && Resources.posixCommandKeywords.includes(word);
      }
      CommandLineTokens.fill(kinds, start, end, CommandTokenKind.Command);
      return false;
    }
    if (word.length > 1 && word.startsWith(Resources.optionStart))
      CommandLineTokens.fill(kinds, start, end, CommandTokenKind.Option);
    else if (CommandLineTokens.isPath(word, isPowerShell))
      CommandLineTokens.fill(kinds, start, end, CommandTokenKind.Path);
    return false;
  }

  private static isPath(word: string, isPowerShell: boolean): boolean {
    const separators: string = isPowerShell ? Resources.powerShellSeparators : Resources.posixSeparators;
    return word.startsWith(Resources.homeStart) || word.startsWith(Resources.currentFolderStart) || [...word].some(t => separators.includes(t));
  }

  private static fill(kinds: (CommandTokenKind | null)[], start: number, end: number, kind: CommandTokenKind): void {
    for (let index: number = start; index < Math.min(end, kinds.length); index++)
      kinds[index] ??= kind;
  }

  private static matchAt(pattern: RegExp, text: string, index: number): number {
    pattern.lastIndex = index;
    return pattern.exec(text)?.[0].length ?? 0;
  }

  private static collect(kinds: readonly (CommandTokenKind | null)[]): readonly CommandToken[] {
    const tokens: CommandToken[] = [];
    let start: number = 0;
    for (let index: number = 1; index <= kinds.length; index++) {
      const kind: CommandTokenKind | null | undefined = kinds[start];
      if (index < kinds.length && kinds[index] === kind)
        continue;
      if (!Object.isNull(kind) && !Object.isUndefined(kind))
        tokens.push(new CommandToken(start, index, kind));
      start = index;
    }
    return tokens;
  }
}
