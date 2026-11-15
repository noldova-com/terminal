/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { TerminalShellKind } from "../../src/enums/terminal-shell-kind.ts";
import { TerminalLaunchParams } from "../../src/models/terminal-launch-params.ts";
import { TerminalSize } from "../../src/models/terminal-size.ts";

describe("TerminalLaunchParams", () => {
  it("writes and reads its wire form", () => {
    const json: object = { shellId: "bash", folder: "/work/project", size: { cols: 100, rows: 40 }, storedLimit: 20_971_520,
      environment: { API_URL: "https://example.com", EMPTY: "" }, notice: "Run login to sign in.\nThen start the agent.",
      command: "curl -fsSL https://example.com/install.sh | bash", opensTab: true };
    const params: TerminalLaunchParams = TerminalLaunchParams.fromJson(json);

    assert.equal(params.shellId, "bash");
    assert.equal(params.folder, "/work/project");
    assert.equal(params.size.columns, 100);
    assert.equal(params.storedLimit, 20_971_520);
    assert.deepEqual(params.environment, { API_URL: "https://example.com", EMPTY: "" });
    assert.equal(params.notice, "Run login to sign in.\nThen start the agent.");
    assert.equal(params.command, "curl -fsSL https://example.com/install.sh | bash");
    assert.deepEqual(params.toJson(), json);
  });

  it("leaves the shell and the folder to the runtime, stores 100 MiB, and has no variables, notice or command unless given", () => {
    const params: TerminalLaunchParams = new TerminalLaunchParams(null, null, new TerminalSize(80, 24));

    assert.deepEqual(params.toJson(),
      { shellId: null, folder: null, size: { cols: 80, rows: 24 }, storedLimit: 104_857_600, environment: {}, notice: null, command: null, opensTab: true });
  });

  it("reads and writes a launch without a tab", () => {
    const params: TerminalLaunchParams = new TerminalLaunchParams(null, null, new TerminalSize(80, 24), undefined, {}, null, "agent login", false);

    assert.equal(params.opensTab, false);
    assert.deepEqual(TerminalLaunchParams.fromJson(params.toJson()), params);
  });

  it("reads and writes the shell kinds a launch takes, which are none when the field is left out", () => {
    const kinds: TerminalShellKind[] = [TerminalShellKind.PowerShell, TerminalShellKind.CommandPrompt];
    const params: TerminalLaunchParams = new TerminalLaunchParams("wsl-Ubuntu", null, new TerminalSize(80, 24), undefined, {}, null, "tool auth login", false, kinds);
    kinds.push(TerminalShellKind.Wsl);

    assert.deepEqual(params.shellKinds, ["PowerShell", "CommandPrompt"]);
    assert.deepEqual(params.toJson()["shellKinds"], ["PowerShell", "CommandPrompt"]);
    assert.deepEqual(TerminalLaunchParams.fromJson(params.toJson()), params);
    assert.deepEqual(new TerminalLaunchParams(null, null, new TerminalSize(80, 24)).shellKinds, []);
    assert.equal("shellKinds" in new TerminalLaunchParams(null, null, new TerminalSize(80, 24)).toJson(), false);
  });

  it("refuses a shell kind that isn't one, naming its index", () => {
    const wire: Record<string, unknown> = { ...new TerminalLaunchParams(null, null, new TerminalSize(80, 24)).toJson() };

    assert.throws(() => new TerminalLaunchParams(null, null, new TerminalSize(80, 24), undefined, {}, null, null, true,
      [TerminalShellKind.Bash, "Tcsh" as TerminalShellKind]), { name: "ArgumentException", parameterName: "shellKinds.1" });
    assert.throws(() => TerminalLaunchParams.fromJson({ ...wire, shellKinds: ["Tcsh"] }), { name: "JsonException", path: "$.shellKinds.0" });
    assert.throws(() => TerminalLaunchParams.fromJson({ ...wire, shellKinds: "Bash" }), { name: "JsonException", path: "$.shellKinds" });
  });

  it("keeps its own copy of the variables", () => {
    const environment: Record<string, string> = { A: "1" };
    const params: TerminalLaunchParams = new TerminalLaunchParams(null, null, new TerminalSize(80, 24), undefined, environment);
    environment["B"] = "2";

    assert.deepEqual(params.environment, { A: "1" });
  });

  it("refuses a variable the terminal sets itself, naming it but not its value", () => {
    assert.throws(() => new TerminalLaunchParams(null, null, new TerminalSize(80, 24), undefined, { COLORTERM: "secret-value" }),
      (error: unknown) => error instanceof Error && error.name === "ArgumentException" && !error.message.includes("secret-value")
        && error.message.includes("environment.COLORTERM"));
    assert.throws(
      () => TerminalLaunchParams.fromJson({ shellId: null, folder: null, size: { cols: 80, rows: 24 }, storedLimit: 104_857_600,
        environment: { NOLDOVA_TERMINAL_NONCE: "x" }, notice: null, command: null, opensTab: true }),
      { name: "JsonException", path: "$.environment.NOLDOVA_TERMINAL_NONCE" });
  });

  it("refuses what only the constructor checks as a JsonException at the field's path when it reads them", () => {
    const wire: Record<string, unknown> = { ...new TerminalLaunchParams(null, null, new TerminalSize(80, 24)).toJson() };
    const many: Record<string, string> = Object.fromEntries(Array.from({ length: 257 }, (_, index) => [`V${index}`, ""]));

    assert.throws(() => TerminalLaunchParams.fromJson({ ...wire, folder: "work" }), { name: "JsonException", path: "$.folder" });
    assert.throws(() => TerminalLaunchParams.fromJson({ ...wire, environment: { "1A": "x" } }), { name: "JsonException", path: "$.environment" });
    assert.throws(() => TerminalLaunchParams.fromJson({ ...wire, environment: { Path: "a", PATH: "b" } }),
      { name: "JsonException", path: "$.environment.PATH" });
    assert.throws(() => TerminalLaunchParams.fromJson({ ...wire, environment: many }), { name: "JsonException", path: "$.environment" });
    assert.throws(() => TerminalLaunchParams.fromJson({ ...wire, environment: { A: "x".repeat(32_767), B: "x".repeat(32_767), C: "x".repeat(32_767),
      D: "x".repeat(32_767), E: "x" } }), { name: "JsonException", path: "$.environment" });
    assert.throws(() => TerminalLaunchParams.fromJson({ ...wire, command: "echo \u0007" }), { name: "JsonException", path: "$.command" });
  });

  it("refuses a variable whose value isn't a string, naming its path", () => {
    assert.throws(
      () => TerminalLaunchParams.fromJson({ shellId: null, folder: null, size: { cols: 80, rows: 24 }, storedLimit: 104_857_600,
        environment: { TOKEN: 7 }, notice: null, command: null, opensTab: true }),
      { name: "JsonException", path: "$.environment.TOKEN" });
  });

  it("refuses a blank or over-long notice, and a blank shell, a relative folder or a limit out of range", () => {
    for (const notice of ["", " \n ", "n".repeat(4_097)])
      assert.throws(() => new TerminalLaunchParams(null, null, new TerminalSize(80, 24), undefined, {}, notice),
        { name: "ArgumentException", parameterName: "notice" });
    assert.equal(new TerminalLaunchParams(null, null, new TerminalSize(80, 24), undefined, {}, "n".repeat(4_096)).notice?.length, 4_096);
    assert.throws(() => new TerminalLaunchParams(" ", null, new TerminalSize(80, 24)), { name: "ArgumentException", parameterName: "shellId" });
    assert.throws(() => new TerminalLaunchParams(null, "work", new TerminalSize(80, 24)), { name: "ArgumentException", parameterName: "folder" });
    assert.throws(() => new TerminalLaunchParams(null, null, new TerminalSize(80, 24), 1), { name: "ArgumentOutOfRangeException", parameterName: "storedLimit" });
  });

  it("refuses a blank or over-long command, and one holding a line break, a tab or another control character", () => {
    for (const command of ["", "   ", "c".repeat(16_385), "npm install\nnpm test", "echo a\r", "echo\ta", "echo \u001b[31m", "echo \u0000",
      "echo \u007f", "echo \u009b"])
      assert.throws(() => new TerminalLaunchParams(null, null, new TerminalSize(80, 24), undefined, {}, null, command),
        { name: "ArgumentException", parameterName: "command" });
    assert.equal(new TerminalLaunchParams(null, null, new TerminalSize(80, 24), undefined, {}, null, "c".repeat(16_384)).command?.length, 16_384);
    assert.equal(new TerminalLaunchParams(null, null, new TerminalSize(80, 24), undefined, {}, null, "echo \"é\" 😀").command, "echo \"é\" 😀");
  });

  it("refuses a missing or unknown field", () => {
    assert.throws(() => TerminalLaunchParams.fromJson({ shellId: null, folder: null, size: { cols: 80, rows: 24 }, storedLimit: 104_857_600, notice: null }),
      { name: "JsonException", path: "$.environment" });
    assert.throws(() => TerminalLaunchParams.fromJson({ shellId: null, folder: null, size: { cols: 80, rows: 24 }, storedLimit: 104_857_600, environment: {},
      notice: null }), { name: "JsonException", path: "$.command" });
    assert.throws(() => TerminalLaunchParams.fromJson({ shellId: null, folder: null, size: { cols: 80, rows: 24 }, storedLimit: 104_857_600, environment: {},
      notice: null, command: null }), { name: "JsonException", path: "$.opensTab" });
    assert.throws(
      () => TerminalLaunchParams.fromJson({ shellId: null, folder: null, size: { cols: 80, rows: 24 }, storedLimit: 104_857_600, environment: {},
        notice: null, command: null, opensTab: true, owner: null }),
      { name: "JsonException", path: "$.owner" });
  });
});
