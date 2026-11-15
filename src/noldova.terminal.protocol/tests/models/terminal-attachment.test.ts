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

import { EndedBy } from "../../src/enums/ended-by.ts";
import { TerminalShellKind } from "../../src/enums/terminal-shell-kind.ts";
import { TerminalAttachment } from "../../src/models/terminal-attachment.ts";
import { TerminalExit } from "../../src/models/terminal-exit.ts";
import { TerminalInputStart } from "../../src/models/terminal-input-start.ts";
import { TerminalLineRange } from "../../src/models/terminal-line-range.ts";
import { TerminalSize } from "../../src/models/terminal-size.ts";
import { WindowsPty } from "../../src/models/windows-pty.ts";

describe("TerminalAttachment", () => {
  it("writes and reads a running terminal", () => {
    const json: object = {
      sessionId: "s1",
      snapshot: "\u001b[1mprompt$ \u001b[0m",
      pending: "\u001b]0;ti",
      offset: 42,
      size: { cols: 80, rows: 24 },
      title: "bash",
      cwd: "/home/me",
      exit: null,
      windowsPty: null,
      stored: { start: 40, end: 1200, dropped: 25 },
      input: { rowsAbove: 1, column: 9, rightPrompt: null },
      commands: ["npm test", "git status"],
      shellKind: "Bash"
    };
    const attachment: TerminalAttachment = TerminalAttachment.fromJson(json);

    assert.equal(attachment.pending, "\u001b]0;ti");
    assert.equal(attachment.cwd, "/home/me");
    assert.equal(attachment.exit, null);
    assert.equal(attachment.windowsPty, null);
    assert.deepEqual([attachment.stored.start, attachment.stored.end, attachment.stored.dropped], [40, 1200, 25]);
    assert.deepEqual([attachment.input?.rowsAbove, attachment.input?.column], [1, 9]);
    assert.deepEqual(attachment.commands, ["npm test", "git status"]);
    assert.equal(attachment.shellKind, TerminalShellKind.Bash);
    assert.deepEqual(attachment.toJson(), json);
  });

  it("writes and reads an ended Windows terminal", () => {
    const attachment: TerminalAttachment = new TerminalAttachment(
      "s1", "", "", 0, new TerminalSize(120, 30), "", null, new TerminalExit(1, EndedBy.Close), new WindowsPty(26100), new TerminalLineRange(0, 0), null, [],
      TerminalShellKind.Other);
    const json: object = {
      sessionId: "s1",
      snapshot: "",
      pending: "",
      offset: 0,
      size: { cols: 120, rows: 30 },
      title: "",
      cwd: null,
      exit: { exitCode: 1, endedBy: "Close" },
      windowsPty: { backend: "conpty", buildNumber: 26100 },
      stored: { start: 0, end: 0, dropped: 0 },
      input: null,
      commands: [],
      shellKind: "Other"
    };

    assert.deepEqual(attachment.toJson(), json);
    assert.equal(TerminalAttachment.fromJson(json).windowsPty?.buildNumber, 26100);
    assert.equal(TerminalAttachment.fromJson(json).exit?.endedBy, EndedBy.Close);
  });

  it("refuses a negative offset", () => {
    assert.throws(() => new TerminalAttachment("s1", "", "", -1, new TerminalSize(80, 24), "", null, null, null, new TerminalLineRange(0, 0), null, [],
      TerminalShellKind.Bash), ArgumentException);
  });

  it("refuses a blank working folder", () => {
    assert.throws(() => new TerminalAttachment("s1", "", "", 0, new TerminalSize(80, 24), "", " ", null, null, new TerminalLineRange(0, 0), null, [],
      TerminalShellKind.Bash), ArgumentException);
  });

  it("refuses a blank session, and a snapshot, pending tail or title longer than its limit", () => {
    const size: TerminalSize = new TerminalSize(80, 24);
    const stored: TerminalLineRange = new TerminalLineRange(0, 0);

    for (const sessionId of ["", " "])
      assert.throws(() => new TerminalAttachment(sessionId, "", "", 0, size, "", null, null, null, stored, null, [], TerminalShellKind.Bash),
        { name: "ArgumentException", parameterName: "sessionId" });
    assert.throws(() => new TerminalAttachment("s1", "s".repeat(16_777_217), "", 0, size, "", null, null, null, stored, null, [], TerminalShellKind.Bash),
      { name: "ArgumentException", parameterName: "snapshot" });
    assert.throws(() => new TerminalAttachment("s1", "", "p".repeat(1_048_577), 0, size, "", null, null, null, stored, null, [], TerminalShellKind.Bash),
      { name: "ArgumentException", parameterName: "pending" });
    assert.throws(() => new TerminalAttachment("s1", "", "", 0, size, "t".repeat(4_097), null, null, null, stored, null, [], TerminalShellKind.Bash),
      { name: "ArgumentException", parameterName: "title" });
  });

  it("keeps its own copy of the commands", () => {
    const commands: string[] = ["npm test"];
    const attachment: TerminalAttachment = new TerminalAttachment("s1", "", "", 0, new TerminalSize(80, 24), "", null, null, null, new TerminalLineRange(0, 0),
      null, commands, TerminalShellKind.Bash);
    commands.push("ls");

    assert.deepEqual(attachment.commands, ["npm test"]);
  });

  it("refuses a stored range that ends before it starts at the range's field when it reads one", () => {
    const json: object = {
      sessionId: "s1", snapshot: "", pending: "", offset: 0, size: { cols: 80, rows: 24 }, title: "", cwd: null, exit: null, windowsPty: null,
      stored: { start: 5, end: 4, dropped: 0 }, input: null, commands: [], shellKind: "Bash"
    };

    assert.throws(() => TerminalAttachment.fromJson(json), { name: "JsonException", path: "$.stored.end" });
  });

  it("refuses a blank command and more commands than a shell keeps", () => {
    const size: TerminalSize = new TerminalSize(80, 24);
    const stored: TerminalLineRange = new TerminalLineRange(0, 0);
    const input: TerminalInputStart = new TerminalInputStart(0, 2);
    const most: readonly string[] = Array.from({ length: 200 }, (_, index) => `echo ${index}`);

    assert.equal(new TerminalAttachment("s1", "", "", 0, size, "", null, null, null, stored, input, most, TerminalShellKind.Bash).commands.length, 200);
    assert.throws(() => new TerminalAttachment("s1", "", "", 0, size, "", null, null, null, stored, input, [...most, "ls"], TerminalShellKind.Bash),
      { name: "ArgumentException", parameterName: "commands" });
    assert.throws(() => new TerminalAttachment("s1", "", "", 0, size, "", null, null, null, stored, input, [" "], TerminalShellKind.Bash), ArgumentException);
    assert.throws(() => new TerminalAttachment("s1", "", "", 0, size, "", null, null, null, stored, input, ["c".repeat(4_097)], TerminalShellKind.Bash), ArgumentException);
    const json: object = {
      sessionId: "s1", snapshot: "", pending: "", offset: 0, size: { cols: 80, rows: 24 }, title: "", cwd: null, exit: null, windowsPty: null,
      stored: { start: 0, end: 0, dropped: 0 }, input: null
    };
    assert.throws(() => TerminalAttachment.fromJson(json), { name: "JsonException", path: "$.commands" });
    assert.throws(() => TerminalAttachment.fromJson({ ...json, commands: ["ls", ""] }), { name: "JsonException", path: "$.commands.1" });
    assert.throws(() => TerminalAttachment.fromJson({ ...json, commands: [...most, "ls"] }), { name: "JsonException", path: "$.commands" });
    assert.throws(() => TerminalAttachment.fromJson({ ...json, input: { rowsAbove: -1, column: 0, rightPrompt: null }, commands: [] }),
      { name: "JsonException", path: "$.input.rowsAbove" });
  });

  it("refuses a shell kind it doesn't know, or none", () => {
    const json: object = {
      sessionId: "s1", snapshot: "", pending: "", offset: 0, size: { cols: 80, rows: 24 }, title: "", cwd: null, exit: null, windowsPty: null,
      stored: { start: 0, end: 0, dropped: 0 }, input: null, commands: []
    };

    assert.equal(TerminalAttachment.fromJson({ ...json, shellKind: "PowerShell" }).shellKind, TerminalShellKind.PowerShell);
    assert.throws(() => TerminalAttachment.fromJson(json), { name: "JsonException", path: "$.shellKind" });
    assert.throws(() => TerminalAttachment.fromJson({ ...json, shellKind: "Tcsh" }), { name: "JsonException", path: "$.shellKind" });
  });

  it("names the nested field it cannot read", () => {
    assert.throws(
      () => TerminalAttachment.fromJson({
        sessionId: "s1", snapshot: "", pending: "", offset: 0, size: { cols: 80, rows: 24 }, title: "", cwd: null, exit: { exitCode: 0 }, windowsPty: null, input: null
      }),
      { name: "JsonException", path: "$.exit.endedBy" });
  });
});
