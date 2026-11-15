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

import { TerminalRunBusy } from "../../src/enums/terminal-run-busy.ts";
import { TerminalShellKind } from "../../src/enums/terminal-shell-kind.ts";
import { TerminalRunParams } from "../../src/models/terminal-run-params.ts";
import { TerminalSize } from "../../src/models/terminal-size.ts";

const SIZE: TerminalSize = new TerminalSize(80, 24);

describe("TerminalRunParams", () => {
  it("writes and reads its wire form", () => {
    const json: object = { owner: "example.chat/42", command: "npm install\r\nnpm test\n", folder: "/work/project", shellKinds: ["Bash", "Zsh"],
      shellId: "zsh", size: { cols: 100, rows: 40 }, storedLimit: 20_971_520, sessionId: "session-1", whenBusy: "Interrupt", opensTab: true };
    const params: TerminalRunParams = TerminalRunParams.fromJson(json);

    assert.equal(params.owner, "example.chat/42");
    assert.equal(params.command, "npm install\r\nnpm test\n");
    assert.equal(params.folder, "/work/project");
    assert.deepEqual(params.shellKinds, [TerminalShellKind.Bash, TerminalShellKind.Zsh]);
    assert.equal(params.shellId, "zsh");
    assert.equal(params.size.columns, 100);
    assert.equal(params.storedLimit, 20_971_520);
    assert.equal(params.sessionId, "session-1");
    assert.equal(params.whenBusy, TerminalRunBusy.Interrupt);
    assert.deepEqual(params.toJson(), json);
  });

  it("takes any shell with no kinds, stores 100 MiB, goes into no given terminal and refuses a busy one unless given, and keeps its own copy of the kinds", () => {
    const kinds: TerminalShellKind[] = [TerminalShellKind.PowerShell];
    const params: TerminalRunParams = new TerminalRunParams("chat", "Get-ChildItem", null, kinds, null, SIZE);
    kinds.push(TerminalShellKind.Bash);

    assert.deepEqual(params.shellKinds, [TerminalShellKind.PowerShell]);
    assert.deepEqual(new TerminalRunParams("chat", "ls", null, [], null, SIZE).toJson(),
      { owner: "chat", command: "ls", folder: null, shellKinds: [], shellId: null, size: { cols: 80, rows: 24 }, storedLimit: 104_857_600,
        sessionId: null, whenBusy: "Refuse", opensTab: true });
    assert.deepEqual([TerminalRunBusy.Refuse, TerminalRunBusy.Interrupt].map(t => new TerminalRunParams("chat", "ls", null, [], null, SIZE, 10_485_760, "session-1", t).whenBusy),
      ["Refuse", "Interrupt"]);
  });

  it("takes several lines, tabs and line breaks at the end, up to the command limit", () => {
    for (const command of ["for f in *; do\n\techo \"$f\"\ndone\n", "a\r\nb\r\n", "c".repeat(16_384), "echo \"é\" 😀"])
      assert.equal(new TerminalRunParams("chat", command, null, [], null, SIZE).command, command);
  });

  it("refuses blank or over-long commands, and a control character other than a line break or a tab, without the commands in its message", () => {
    for (const command of ["", " \n\t ", "c".repeat(16_385), "echo a\r", "echo a\rmore", "echo \u001b[31m", "echo \u0000", "echo \u000b", "echo \u000c",
      "echo \u007f", "echo \u009b"])
      assert.throws(() => new TerminalRunParams("chat", command, null, [], null, SIZE),
        (error: unknown) => error instanceof ArgumentException && error.parameterName === "command"
          && (command.trim() === "" || !error.message.includes(command)));
  });

  it("refuses a blank or over-long owner, a relative folder, an unknown kind, a blank shell or a limit out of range", () => {
    for (const owner of ["", "  ", "o".repeat(257)])
      assert.throws(() => new TerminalRunParams(owner, "ls", null, [], null, SIZE), { name: "ArgumentException", parameterName: "owner" });
    assert.throws(() => new TerminalRunParams("chat", "ls", "work", [], null, SIZE), { name: "ArgumentException", parameterName: "folder" });
    assert.throws(() => new TerminalRunParams("chat", "ls", null, [TerminalShellKind.Bash, "Csh" as TerminalShellKind], null, SIZE),
      { name: "ArgumentException", parameterName: "shellKinds.1" });
    assert.throws(() => new TerminalRunParams("chat", "ls", null, [], " ", SIZE), { name: "ArgumentException", parameterName: "shellId" });
    assert.throws(() => new TerminalRunParams("chat", "ls", null, [], null, SIZE, 1), { name: "ArgumentOutOfRangeException", parameterName: "storedLimit" });
  });

  it("refuses a blank or over-long terminal, and a busy choice that isn't one", () => {
    for (const sessionId of ["", " ", "s".repeat(201)])
      assert.throws(() => new TerminalRunParams("chat", "ls", null, [], null, SIZE, 104_857_600, sessionId), { name: "ArgumentException", parameterName: "sessionId" });
    assert.throws(() => new TerminalRunParams("chat", "ls", null, [], null, SIZE, 104_857_600, "session-1", "Wait" as TerminalRunBusy),
      { name: "ArgumentException", parameterName: "whenBusy", message: "The value must be one of Refuse, Interrupt. (Parameter 'whenBusy')" });
  });

  it("refuses a missing or unknown field, and a kind that isn't one", () => {
    const json: Record<string, unknown> = { owner: "chat", command: "ls", folder: null, shellKinds: [], shellId: null, size: { cols: 80, rows: 24 },
      storedLimit: 104_857_600, sessionId: null, whenBusy: "Refuse", opensTab: true };

    assert.throws(() => TerminalRunParams.fromJson({ ...json, shellKinds: undefined }), { name: "JsonException", path: "$.shellKinds" });
    assert.throws(() => TerminalRunParams.fromJson({ ...json, shellKinds: "Bash" }), { name: "JsonException", path: "$.shellKinds" });
    assert.throws(() => TerminalRunParams.fromJson({ ...json, shellKinds: ["Bash", 7] }), { name: "JsonException", path: "$.shellKinds.1" });
    assert.throws(() => TerminalRunParams.fromJson({ ...json, environment: {} }), { name: "JsonException", path: "$.environment" });
    assert.throws(() => TerminalRunParams.fromJson({ ...json, sessionId: undefined }), { name: "JsonException", path: "$.sessionId" });
    assert.throws(() => TerminalRunParams.fromJson({ ...json, sessionId: " " }), { name: "JsonException", path: "$.sessionId" });
    assert.throws(() => TerminalRunParams.fromJson({ ...json, whenBusy: undefined }), { name: "JsonException", path: "$.whenBusy" });
    assert.throws(() => TerminalRunParams.fromJson({ ...json, whenBusy: "Wait" }), { name: "JsonException", path: "$.whenBusy" });
    assert.throws(() => TerminalRunParams.fromJson({ ...json, command: "a\u0000" }), { name: "JsonException", path: "$.command" });
  });

  it("refuses a hidden character and a relative folder as a JsonException at the field's path when it reads them", () => {
    const json: Record<string, unknown> = { owner: "chat", command: "ls", folder: null, shellKinds: [], shellId: null, size: { cols: 80, rows: 24 },
      storedLimit: 104_857_600, sessionId: null, whenBusy: "Refuse", opensTab: true };

    assert.throws(() => TerminalRunParams.fromJson({ ...json, command: "ls​" }), { name: "JsonException", path: "$.command" });
    assert.throws(() => TerminalRunParams.fromJson({ ...json, folder: "work" }), { name: "JsonException", path: "$.folder" });
  });
});
