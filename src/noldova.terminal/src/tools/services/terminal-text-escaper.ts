/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import { Resources } from "../../resources.ts";

export class TerminalTextEscaper {
  public static hasControls(text: string): boolean {
    return Resources.terminalTextEscaperControls.test(text);
  }

  public static hasHiddenCharacters(text: string): boolean {
    return Resources.terminalTextEscaperHiddenCharacters.test(text);
  }

  public static escape(text: string): string {
    let escaped: string = "";
    for (const character of text)
      escaped += TerminalTextEscaper.escapeCharacter(character);
    return escaped;
  }

  public static escapeHidden(text: string): string {
    return text.replaceAll(new RegExp(Resources.terminalTextEscaperHiddenCharacters.source, Resources.terminalTextEscaperSearchFlags),
      t => TerminalTextEscaper.formatCodePoint(t));
  }

  public static escapeUnseen(text: string): string {
    return text.replaceAll(new RegExp(Resources.formatTerminalTextEscaperAlternation(Resources.terminalTextEscaperControls.source,
      Resources.terminalTextEscaperHiddenCharacters.source), Resources.terminalTextEscaperSearchFlags), t => TerminalTextEscaper.formatCodePoint(t));
  }

  private static escapeCharacter(character: string): string {
    const name: string | undefined = Resources.terminalTextEscaperNamed.get(character);
    if (!Object.isUndefined(name))
      return name;
    if (TerminalTextEscaper.hasControls(character) || TerminalTextEscaper.hasHiddenCharacters(character))
      return TerminalTextEscaper.formatCodePoint(character);
    return character;
  }

  private static formatCodePoint(character: string): string {
    return Resources.formatTerminalTextEscaperCodePoint(Number(character.codePointAt(0)).toString(Resources.hexadecimalRadix).toUpperCase()
      .padStart(Resources.terminalTextEscaperCodePointDigits, Resources.terminalTextEscaperCodePointPad));
  }
}
