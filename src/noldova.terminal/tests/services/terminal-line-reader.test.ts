/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import assert from "node:assert/strict";

import { TerminalTextStyle, type TerminalLine } from "@noldova/terminal.protocol";
import type { IBuffer, IBufferLine, Terminal as XtermTerminal } from "@xterm/headless";
import { describe, it } from "vitest";

import { TerminalLineReader } from "../../src/services/terminal-line-reader.ts";
import { XtermHeadlessLoader } from "../../src/services/xterm-headless-loader.ts";

async function readAsync(text: string, columns: number): Promise<readonly TerminalLine[]> {
  const terminal: XtermTerminal = XtermHeadlessLoader.createTerminal({ cols: columns, rows: 10, allowProposedApi: true });
  await new Promise<void>(t => terminal.write(text, t));
  const buffer: IBuffer = terminal.buffer.normal;
  const reader: TerminalLineReader = new TerminalLineReader(buffer.getNullCell());
  const lines: TerminalLine[] = [];
  for (let y: number = 0; y <= buffer.cursorY; y++) {
    const line: IBufferLine | undefined = buffer.getLine(y);
    if (!Object.isUndefined(line))
      lines.push(reader.read(line, false));
  }
  terminal.dispose();
  return lines;
}

describe("TerminalLineReader", () => {
  it("reads plain text without its trailing blanks", async () => {
    const [line] = await readAsync("hello   ", 20);

    assert.equal(line?.text, "hello");
    assert.deepEqual(line?.runs.map(t => t.toJson()), [{ length: 5, foreground: -1, background: -1, style: 0 }]);
    assert.equal(line?.isWrapped, false);
  });

  it("reads palette and RGB colors", async () => {
    const [line] = await readAsync("\u001b[31mr\u001b[38;5;200mp\u001b[38;2;1;2;3mt\u001b[41mb\u001b[48;2;4;5;6mg\u001b[0m.", 20);

    assert.equal(line?.text, "rptbg.");
    assert.equal(
      line?.runs.map(t => `${t.foreground}/${t.background}`).join(","),
      "1/-1,200/-1,16843267/-1,16843267/1,16843267/17040646,-1/-1");
  });

  it("reads every style", async () => {
    const codes: readonly number[] = [1, 2, 3, 4, 5, 7, 8, 9, 53];
    const [line] = await readAsync(codes.map(t => `\u001b[${t}mx\u001b[0m`).join(""), 20);

    assert.deepEqual(line?.runs.map(t => t.style), [
      TerminalTextStyle.Bold, TerminalTextStyle.Dim, TerminalTextStyle.Italic, TerminalTextStyle.Underline, TerminalTextStyle.Blink,
      TerminalTextStyle.Inverse, TerminalTextStyle.Invisible, TerminalTextStyle.Strikethrough, TerminalTextStyle.Overline
    ]);
  });

  it("reads wide characters once and the gaps between characters as blanks", async () => {
    const [line] = await readAsync("日本\u001b[3Cx", 20);

    assert.equal(line?.text, "日本   x");
    assert.equal(line?.runs[0]?.length, 6);
  });

  it("reads colored wide characters once and the gaps after them as blanks", async () => {
    const [line] = await readAsync("\u001b[31m日本\u001b[0m\u001b[2Cx", 20);

    assert.equal(line?.text, "日本  x");
    assert.deepEqual(line?.runs.map(t => [t.length, t.foreground]), [[2, 1], [3, -1]]);
  });

  it("keeps the trailing blanks that show", async () => {
    const lines: readonly TerminalLine[] = await readAsync(
      "a\u001b[41m  \u001b[0m\r\nb\u001b[7m \u001b[0m\r\nc\u001b[4m \u001b[0m\r\nd\u001b[9m \u001b[0m\r\ne\u001b[53m \u001b[0m\r\nf\u001b[31m \u001b[0m", 20);

    assert.equal(lines.map(t => t.text).join(","), "a  ,b ,c ,d ,e ,f");
  });

  it("keeps the full width of a line the next one continues", async () => {
    const terminal: XtermTerminal = XtermHeadlessLoader.createTerminal({ cols: 10, rows: 4, allowProposedApi: true });
    await new Promise<void>(t => terminal.write("abcdefgh  xyz", t));
    const buffer: IBuffer = terminal.buffer.normal;
    const reader: TerminalLineReader = new TerminalLineReader(buffer.getNullCell());
    const first: IBufferLine | undefined = buffer.getLine(0);
    const second: IBufferLine | undefined = buffer.getLine(1);
    assert.ok(!Object.isUndefined(first) && !Object.isUndefined(second));

    const continued: TerminalLine = reader.read(first, true);
    const next: TerminalLine = reader.read(second, false);
    terminal.dispose();

    assert.equal(continued.text, "abcdefgh  ");
    assert.equal(next.text, "xyz");
    assert.equal(next.isWrapped, true);
  });
});
