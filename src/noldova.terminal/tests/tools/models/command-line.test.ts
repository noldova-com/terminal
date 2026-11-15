/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { ArgumentException } from "@noldova/context.exceptions";
import { describe, it } from "vitest";

import { CommandLine } from "../../../src/tools/models/command-line.ts";

describe("CommandLine", () => {
  it("keeps one command line as written", () => {
    const command: CommandLine = new CommandLine("git status --short");

    assert.equal(command.text, "git status --short");
    assert.equal(command.display, "git status --short");
    assert.equal(command.hasHiddenCharacters, false);
  });

  it("shows hidden characters escaped and flags them", () => {
    const command: CommandLine = new CommandLine("echo safe\u202E;rm -rf ~");

    assert.equal(command.display, "echo safe\\u{202E};rm -rf ~");
    assert.equal(command.hasHiddenCharacters, true);
  });

  for (const text of ["ls\n", "ls\r", "a\tb", "\u001b[31m", "a\u007f", "a\u0085b", "\u0000"]) {
    it(`refuses the control character in ${JSON.stringify(text)}`, () => {
      assert.throws(() => new CommandLine(text), { name: "ArgumentException", message: "The value must be one line, without control characters. (Parameter 'command')" });
    });
  }

  it("refuses a blank command", () => {
    assert.throws(() => new CommandLine("  "), ArgumentException);
  });

  it("accepts 16384 bytes of UTF-8 and refuses more", () => {
    assert.equal(new CommandLine("é".repeat(8_192)).text.length, 8_192);
    assert.throws(() => new CommandLine(`${"é".repeat(8_192)}x`), { name: "ArgumentException", message: "The value must have at most 16384 bytes in UTF-8. (Parameter 'command')" });
    assert.throws(() => new CommandLine("x".repeat(16_385)), ArgumentException);
  });
});
