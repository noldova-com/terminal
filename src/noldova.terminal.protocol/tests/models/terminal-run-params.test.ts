/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/context.exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { TerminalRunBusy, TerminalRunParams, TerminalShellKind, TerminalSize } from "@noldova/terminal.protocol";

import { Expect } from "../support/expect.ts";

const SIZE: TerminalSize = new TerminalSize(80, 24);

@TestClass
export class TerminalRunParamsTests {
  @TestMethod
  public writesAndReadsItsWireForm(): void {
    const json: object = { owner: "example.chat/42", command: "npm install\r\nnpm test\n", folder: "/work/project", shellKinds: ["Bash", "Zsh"],
      shellId: "zsh", size: { cols: 100, rows: 40 }, storedLimit: 20_971_520, sessionId: "session-1", whenBusy: "Interrupt", opensTab: true };
    const params: TerminalRunParams = TerminalRunParams.fromJson(json);

    Assert.areEqual("example.chat/42", params.owner);
    Assert.areEqual("npm install\r\nnpm test\n", params.command);
    Assert.areEqual("/work/project", params.folder);
    Expect.same([TerminalShellKind.Bash, TerminalShellKind.Zsh], params.shellKinds);
    Assert.areEqual("zsh", params.shellId);
    Assert.areEqual(100, params.size.columns);
    Assert.areEqual(20_971_520, params.storedLimit);
    Assert.areEqual("session-1", params.sessionId);
    Assert.areEqual(TerminalRunBusy.Interrupt, params.whenBusy);
    Expect.same(json, params.toJson());
  }

  @TestMethod
  public takesAnyShellWithNoKindsStores100MiBGoesIntoNoGivenTerminalAndRefusesABusyOneUnlessGivenAndKeepsItsOwnCopyOfTheKinds(): void {
    const kinds: TerminalShellKind[] = [TerminalShellKind.PowerShell];
    const params: TerminalRunParams = new TerminalRunParams("chat", "Get-ChildItem", null, kinds, null, SIZE);
    kinds.push(TerminalShellKind.Bash);

    Expect.same([TerminalShellKind.PowerShell], params.shellKinds);
    Expect.same({ owner: "chat", command: "ls", folder: null, shellKinds: [], shellId: null, size: { cols: 80, rows: 24 }, storedLimit: 104_857_600,
        sessionId: null, whenBusy: "Refuse", opensTab: true }, new TerminalRunParams("chat", "ls", null, [], null, SIZE).toJson());
    Expect.same(["Refuse", "Interrupt"], [TerminalRunBusy.Refuse, TerminalRunBusy.Interrupt].map(t => new TerminalRunParams("chat", "ls", null, [], null, SIZE, 10_485_760, "session-1", t).whenBusy));
  }

  @TestMethod
  public takesSeveralLinesTabsAndLineBreaksAtTheEndUpToTheCommandLimit(): void {
    for (const command of ["for f in *; do\n\techo \"$f\"\ndone\n", "a\r\nb\r\n", "c".repeat(16_384), "echo \"é\" 😀"])
      Assert.areEqual(command, new TerminalRunParams("chat", command, null, [], null, SIZE).command);
  }

  @TestMethod
  public refusesBlankOrOverLongCommandsAndAControlCharacterOtherThanALineBreakOrATabWithoutTheCommandsInItsMessage(): void {
    for (const command of ["", " \n\t ", "c".repeat(16_385), "echo a\r", "echo a\rmore", "echo \u001b[31m", "echo \u0000", "echo \u000b", "echo \u000c",
      "echo \u007f", "echo \u009b"]) {
      const error: ArgumentException = Assert.throws(() => new TerminalRunParams("chat", command, null, [], null, SIZE), ArgumentException);
      Assert.areEqual("command", error.parameterName);
      Assert.isTrue(command.trim() === "" || !error.message.includes(command), error.message);
    }
  }

  @TestMethod
  public refusesABlankOrOverLongOwnerARelativeFolderAnUnknownKindABlankShellOrALimitOutOfRange(): void {
    for (const owner of ["", "  ", "o".repeat(257)])
      Expect.throwsMatching(() => new TerminalRunParams(owner, "ls", null, [], null, SIZE), { name: "ArgumentException", parameterName: "owner" });
    Expect.throwsMatching(() => new TerminalRunParams("chat", "ls", "work", [], null, SIZE), { name: "ArgumentException", parameterName: "folder" });
    Expect.throwsMatching(() => new TerminalRunParams("chat", "ls", null, [TerminalShellKind.Bash, "Csh" as TerminalShellKind], null, SIZE), { name: "ArgumentException", parameterName: "shellKinds.1" });
    Expect.throwsMatching(() => new TerminalRunParams("chat", "ls", null, [], " ", SIZE), { name: "ArgumentException", parameterName: "shellId" });
    Expect.throwsMatching(() => new TerminalRunParams("chat", "ls", null, [], null, SIZE, 1), { name: "ArgumentOutOfRangeException", parameterName: "storedLimit" });
  }

  @TestMethod
  public refusesABlankOrOverLongTerminalAndABusyChoiceThatIsntOne(): void {
    for (const sessionId of ["", " ", "s".repeat(201)])
      Expect.throwsMatching(() => new TerminalRunParams("chat", "ls", null, [], null, SIZE, 104_857_600, sessionId), { name: "ArgumentException", parameterName: "sessionId" });
    Expect.throwsMatching(() => new TerminalRunParams("chat", "ls", null, [], null, SIZE, 104_857_600, "session-1", "Wait" as TerminalRunBusy), { name: "ArgumentException", parameterName: "whenBusy", message: "The value must be one of Refuse, Interrupt. (Parameter 'whenBusy')" });
  }

  @TestMethod
  public refusesAMissingOrUnknownFieldAndAKindThatIsntOne(): void {
    const json: Record<string, unknown> = { owner: "chat", command: "ls", folder: null, shellKinds: [], shellId: null, size: { cols: 80, rows: 24 },
      storedLimit: 104_857_600, sessionId: null, whenBusy: "Refuse", opensTab: true };

    Expect.throwsMatching(() => TerminalRunParams.fromJson({ ...json, shellKinds: undefined }), { name: "JsonException", path: "$.shellKinds" });
    Expect.throwsMatching(() => TerminalRunParams.fromJson({ ...json, shellKinds: "Bash" }), { name: "JsonException", path: "$.shellKinds" });
    Expect.throwsMatching(() => TerminalRunParams.fromJson({ ...json, shellKinds: ["Bash", 7] }), { name: "JsonException", path: "$.shellKinds.1" });
    Expect.throwsMatching(() => TerminalRunParams.fromJson({ ...json, environment: {} }), { name: "JsonException", path: "$.environment" });
    Expect.throwsMatching(() => TerminalRunParams.fromJson({ ...json, sessionId: undefined }), { name: "JsonException", path: "$.sessionId" });
    Expect.throwsMatching(() => TerminalRunParams.fromJson({ ...json, sessionId: " " }), { name: "JsonException", path: "$.sessionId" });
    Expect.throwsMatching(() => TerminalRunParams.fromJson({ ...json, whenBusy: undefined }), { name: "JsonException", path: "$.whenBusy" });
    Expect.throwsMatching(() => TerminalRunParams.fromJson({ ...json, whenBusy: "Wait" }), { name: "JsonException", path: "$.whenBusy" });
    Expect.throwsMatching(() => TerminalRunParams.fromJson({ ...json, command: "a\u0000" }), { name: "JsonException", path: "$.command" });
  }

  @TestMethod
  public refusesAHiddenCharacterAndARelativeFolderAsAJsonExceptionAtTheFieldsPathWhenItReadsThem(): void {
    const json: Record<string, unknown> = { owner: "chat", command: "ls", folder: null, shellKinds: [], shellId: null, size: { cols: 80, rows: 24 },
      storedLimit: 104_857_600, sessionId: null, whenBusy: "Refuse", opensTab: true };

    Expect.throwsMatching(() => TerminalRunParams.fromJson({ ...json, command: "ls​" }), { name: "JsonException", path: "$.command" });
    Expect.throwsMatching(() => TerminalRunParams.fromJson({ ...json, folder: "work" }), { name: "JsonException", path: "$.folder" });
  }
}
