/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/context.exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { EndedBy, TerminalAttachment, TerminalExit, TerminalInputStart, TerminalLineRange, TerminalShellKind, TerminalSize, WindowsPty,

} from "@noldova/terminal.protocol";

import { Expect } from "../support/expect.ts";

@TestClass
export class TerminalAttachmentTests {
  @TestMethod
  public writesAndReadsARunningTerminal(): void {
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

    Assert.areEqual("\u001b]0;ti", attachment.pending);
    Assert.areEqual("/home/me", attachment.cwd);
    Assert.areEqual(null, attachment.exit);
    Assert.areEqual(null, attachment.windowsPty);
    Expect.same([40, 1200, 25], [attachment.stored.start, attachment.stored.end, attachment.stored.dropped]);
    Expect.same([1, 9], [attachment.input?.rowsAbove, attachment.input?.column]);
    Expect.same(["npm test", "git status"], attachment.commands);
    Assert.areEqual(TerminalShellKind.Bash, attachment.shellKind);
    Expect.same(json, attachment.toJson());
  }

  @TestMethod
  public writesAndReadsAnEndedWindowsTerminal(): void {
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

    Expect.same(json, attachment.toJson());
    Assert.areEqual(26100, TerminalAttachment.fromJson(json).windowsPty?.buildNumber);
    Assert.areEqual(EndedBy.Close, TerminalAttachment.fromJson(json).exit?.endedBy);
  }

  @TestMethod
  public refusesANegativeOffset(): void {
    Assert.throws(() => new TerminalAttachment("s1", "", "", -1, new TerminalSize(80, 24), "", null, null, null, new TerminalLineRange(0, 0), null, [],
      TerminalShellKind.Bash), ArgumentException);
  }

  @TestMethod
  public refusesABlankWorkingFolder(): void {
    Assert.throws(() => new TerminalAttachment("s1", "", "", 0, new TerminalSize(80, 24), "", " ", null, null, new TerminalLineRange(0, 0), null, [],
      TerminalShellKind.Bash), ArgumentException);
  }

  @TestMethod
  public refusesABlankSessionAndASnapshotPendingTailOrTitleLongerThanItsLimit(): void {
    const size: TerminalSize = new TerminalSize(80, 24);
    const stored: TerminalLineRange = new TerminalLineRange(0, 0);

    for (const sessionId of ["", " "])
      Expect.throwsMatching(() => new TerminalAttachment(sessionId, "", "", 0, size, "", null, null, null, stored, null, [], TerminalShellKind.Bash), { name: "ArgumentException", parameterName: "sessionId" });
    Expect.throwsMatching(() => new TerminalAttachment("s1", "s".repeat(16_777_217), "", 0, size, "", null, null, null, stored, null, [], TerminalShellKind.Bash), { name: "ArgumentException", parameterName: "snapshot" });
    Expect.throwsMatching(() => new TerminalAttachment("s1", "", "p".repeat(1_048_577), 0, size, "", null, null, null, stored, null, [], TerminalShellKind.Bash), { name: "ArgumentException", parameterName: "pending" });
    Expect.throwsMatching(() => new TerminalAttachment("s1", "", "", 0, size, "t".repeat(4_097), null, null, null, stored, null, [], TerminalShellKind.Bash), { name: "ArgumentException", parameterName: "title" });
  }

  @TestMethod
  public keepsItsOwnCopyOfTheCommands(): void {
    const commands: string[] = ["npm test"];
    const attachment: TerminalAttachment = new TerminalAttachment("s1", "", "", 0, new TerminalSize(80, 24), "", null, null, null, new TerminalLineRange(0, 0),
      null, commands, TerminalShellKind.Bash);
    commands.push("ls");

    Expect.same(["npm test"], attachment.commands);
  }

  @TestMethod
  public refusesAStoredRangeThatEndsBeforeItStartsAtTheRangesFieldWhenItReadsOne(): void {
    const json: object = {
      sessionId: "s1", snapshot: "", pending: "", offset: 0, size: { cols: 80, rows: 24 }, title: "", cwd: null, exit: null, windowsPty: null,
      stored: { start: 5, end: 4, dropped: 0 }, input: null, commands: [], shellKind: "Bash"
    };

    Expect.throwsMatching(() => TerminalAttachment.fromJson(json), { name: "JsonException", path: "$.stored.end" });
  }

  @TestMethod
  public refusesABlankCommandAndMoreCommandsThanAShellKeeps(): void {
    const size: TerminalSize = new TerminalSize(80, 24);
    const stored: TerminalLineRange = new TerminalLineRange(0, 0);
    const input: TerminalInputStart = new TerminalInputStart(0, 2);
    const most: readonly string[] = Array.from({ length: 200 }, (_, index) => `echo ${index}`);

    Assert.areEqual(200, new TerminalAttachment("s1", "", "", 0, size, "", null, null, null, stored, input, most, TerminalShellKind.Bash).commands.length);
    Expect.throwsMatching(() => new TerminalAttachment("s1", "", "", 0, size, "", null, null, null, stored, input, [...most, "ls"], TerminalShellKind.Bash), { name: "ArgumentException", parameterName: "commands" });
    Assert.throws(() => new TerminalAttachment("s1", "", "", 0, size, "", null, null, null, stored, input, [" "], TerminalShellKind.Bash), ArgumentException);
    Assert.throws(() => new TerminalAttachment("s1", "", "", 0, size, "", null, null, null, stored, input, ["c".repeat(4_097)], TerminalShellKind.Bash), ArgumentException);
    const json: object = {
      sessionId: "s1", snapshot: "", pending: "", offset: 0, size: { cols: 80, rows: 24 }, title: "", cwd: null, exit: null, windowsPty: null,
      stored: { start: 0, end: 0, dropped: 0 }, input: null
    };
    Expect.throwsMatching(() => TerminalAttachment.fromJson(json), { name: "JsonException", path: "$.commands" });
    Expect.throwsMatching(() => TerminalAttachment.fromJson({ ...json, commands: ["ls", ""] }), { name: "JsonException", path: "$.commands.1" });
    Expect.throwsMatching(() => TerminalAttachment.fromJson({ ...json, commands: [...most, "ls"] }), { name: "JsonException", path: "$.commands" });
    Expect.throwsMatching(() => TerminalAttachment.fromJson({ ...json, input: { rowsAbove: -1, column: 0, rightPrompt: null }, commands: [] }), { name: "JsonException", path: "$.input.rowsAbove" });
  }

  @TestMethod
  public refusesAShellKindItDoesntKnowOrNone(): void {
    const json: object = {
      sessionId: "s1", snapshot: "", pending: "", offset: 0, size: { cols: 80, rows: 24 }, title: "", cwd: null, exit: null, windowsPty: null,
      stored: { start: 0, end: 0, dropped: 0 }, input: null, commands: []
    };

    Assert.areEqual(TerminalShellKind.PowerShell, TerminalAttachment.fromJson({ ...json, shellKind: "PowerShell" }).shellKind);
    Expect.throwsMatching(() => TerminalAttachment.fromJson(json), { name: "JsonException", path: "$.shellKind" });
    Expect.throwsMatching(() => TerminalAttachment.fromJson({ ...json, shellKind: "Tcsh" }), { name: "JsonException", path: "$.shellKind" });
  }

  @TestMethod
  public namesTheNestedFieldItCannotRead(): void {
    Expect.throwsMatching(() => TerminalAttachment.fromJson({
        sessionId: "s1", snapshot: "", pending: "", offset: 0, size: { cols: 80, rows: 24 }, title: "", cwd: null, exit: { exitCode: 0 }, windowsPty: null, input: null
      }), { name: "JsonException", path: "$.exit.endedBy" });
  }
}
