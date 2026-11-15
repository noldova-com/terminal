/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { TrackedCommand } from "../../src/models/tracked-command.ts";
import { TypedLine } from "../../src/models/typed-line.ts";

describe("TypedLine", () => {
  it("starts open at its offset with no command or end", () => {
    const line: TypedLine = new TypedLine(4, "ls -la");

    assert.equal(line.startOffset, 4);
    assert.equal(line.command, null);
    assert.equal(line.endOffset, null);
    assert.equal(line.isOpen, true);
  });

  it("ends at the next prompt once the shell echoed the line and a line feed", () => {
    const line: TypedLine = new TypedLine(4, "ls -la");

    line.read("$ ls -la\r\n");
    line.prompt(20);

    assert.equal(line.endOffset, 20);
    assert.equal(line.isOpen, false);
  });

  it("stays open at a prompt while the echo has no line feed after it", () => {
    const line: TypedLine = new TypedLine(4, "ls -la");

    line.read("$ ls -la");
    line.prompt(20);

    assert.equal(line.endOffset, null);
    assert.equal(line.isOpen, true);
  });

  it("stays open at a prompt when the shell echoed another line", () => {
    const line: TypedLine = new TypedLine(4, "ls -la");

    line.read("$ pwd\r\n");
    line.prompt(20);

    assert.equal(line.endOffset, null);
  });

  it("finds an echo split across reads and spaced differently", () => {
    const line: TypedLine = new TypedLine(0, "ls  -la");

    line.read("ls ");
    line.read("-l");
    line.read("a\n");
    line.prompt(9);

    assert.equal(line.endOffset, 9);
  });

  it("waits only for the echo of the text's last line", () => {
    const afterLineFeed: TypedLine = new TypedLine(0, "cd /\nls");
    const afterEnter: TypedLine = new TypedLine(0, "cd /\rpwd");

    afterLineFeed.read("ls\n");
    afterLineFeed.prompt(3);
    afterEnter.read("pwd\n");
    afterEnter.prompt(4);

    assert.equal(afterLineFeed.endOffset, 3);
    assert.equal(afterEnter.endOffset, 4);
  });

  it("is no longer open once it has a command", () => {
    const line: TypedLine = new TypedLine(0, "make");

    line.command = new TrackedCommand(5, true);

    assert.equal(line.isOpen, false);
  });
});
