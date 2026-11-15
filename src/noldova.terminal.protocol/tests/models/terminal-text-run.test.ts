/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { TerminalTextStyle } from "../../src/enums/terminal-text-style.ts";
import { TerminalTextRun } from "../../src/models/terminal-text-run.ts";
import { ProtocolReader } from "../../src/services/protocol.reader.ts";

describe("TerminalTextRun", () => {
  it("writes and reads its wire form", () => {
    const json: object = { length: 5, foreground: 1, background: 0x1102030, style: 9 };
    const run: TerminalTextRun = TerminalTextRun.fromReader(ProtocolReader.fromValue(json));

    assert.deepEqual([run.length, run.foreground, run.background, run.style], [5, 1, 0x1102030, TerminalTextStyle.Bold | TerminalTextStyle.Underline]);
    assert.deepEqual(run.toJson(), json);
  });

  it("takes the default color, palette colors and RGB colors, and every style", () => {
    for (const color of [-1, 0, 255, 0x1000000, 0x1ffffff])
      assert.deepEqual([new TerminalTextRun(1, color, -1, 0).foreground, new TerminalTextRun(1, -1, color, 0).background], [color, color]);
    assert.equal(new TerminalTextRun(1, -1, -1, 0x1ff).style, 0x1ff);
  });

  it("refuses an empty run, a color outside the three kinds and an unknown style", () => {
    for (const length of [0, 1.5])
      assert.throws(() => new TerminalTextRun(length, -1, -1, 0), { name: "ArgumentOutOfRangeException", parameterName: "length" });
    for (const color of [-2, 256, 0xffffff, 0x2000000, 1.5]) {
      assert.throws(() => new TerminalTextRun(1, color, -1, 0), { name: "ArgumentException", parameterName: "foreground" });
      assert.throws(() => new TerminalTextRun(1, -1, color, 0), { name: "ArgumentException", parameterName: "background" });
    }
    for (const style of [-1, 512, 0.5])
      assert.throws(() => new TerminalTextRun(1, -1, -1, style), { name: "ArgumentOutOfRangeException", parameterName: "style" });
  });

  it("names the field it cannot read", () => {
    assert.throws(
      () => TerminalTextRun.fromReader(ProtocolReader.fromValue({ length: 1, foreground: "red", background: -1, style: 0 })),
      { name: "JsonException", path: "$.foreground" });
  });

  it("refuses a color between the palette and RGB colors at its field when it reads one", () => {
    assert.throws(() => TerminalTextRun.fromReader(ProtocolReader.fromValue({ length: 1, foreground: 256, background: -1, style: 0 })),
      { name: "JsonException", path: "$.foreground" });
    assert.throws(() => TerminalTextRun.fromReader(ProtocolReader.fromValue({ length: 1, foreground: -1, background: 0xffffff, style: 0 })),
      { name: "JsonException", path: "$.background" });
  });
});
