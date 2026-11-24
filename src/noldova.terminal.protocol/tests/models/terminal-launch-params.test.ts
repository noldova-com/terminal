/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { TerminalShellKind } from "../../src/enums/terminal-shell-kind.ts";
import { TerminalLaunchParams } from "../../src/models/terminal-launch-params.ts";
import { TerminalSize } from "../../src/models/terminal-size.ts";
import { Expect } from "../support/expect.ts";

@TestClass
export class TerminalLaunchParamsTests {
  @TestMethod
  public writesAndReadsItsWireForm(): void {
    const json: object = { shellId: "bash", folder: "/work/project", size: { cols: 100, rows: 40 }, storedLimit: 20_971_520,
      environment: { API_URL: "https://example.com", EMPTY: "" }, notice: "Run login to sign in.\nThen start the agent.",
      command: "curl -fsSL https://example.com/install.sh | bash", opensTab: true };
    const params: TerminalLaunchParams = TerminalLaunchParams.fromJson(json);

    Assert.areEqual("bash", params.shellId);
    Assert.areEqual("/work/project", params.folder);
    Assert.areEqual(100, params.size.columns);
    Assert.areEqual(20_971_520, params.storedLimit);
    Expect.same({ API_URL: "https://example.com", EMPTY: "" }, params.environment);
    Assert.areEqual("Run login to sign in.\nThen start the agent.", params.notice);
    Assert.areEqual("curl -fsSL https://example.com/install.sh | bash", params.command);
    Expect.same(json, params.toJson());
  }

  @TestMethod
  public leavesTheShellAndTheFolderToTheRuntimeStores100MiBAndHasNoVariablesNoticeOrCommandUnlessGiven(): void {
    const params: TerminalLaunchParams = new TerminalLaunchParams(null, null, new TerminalSize(80, 24));

    Expect.same({ shellId: null, folder: null, size: { cols: 80, rows: 24 }, storedLimit: 104_857_600, environment: {}, notice: null, command: null, opensTab: true }, params.toJson());
  }

  @TestMethod
  public readsAndWritesALaunchWithoutATab(): void {
    const params: TerminalLaunchParams = new TerminalLaunchParams(null, null, new TerminalSize(80, 24), undefined, {}, null, "agent login", false);

    Assert.areEqual(false, params.opensTab);
    Expect.same(params, TerminalLaunchParams.fromJson(params.toJson()));
  }

  @TestMethod
  public readsAndWritesTheShellKindsALaunchTakesWhichAreNoneWhenTheFieldIsLeftOut(): void {
    const kinds: TerminalShellKind[] = [TerminalShellKind.PowerShell, TerminalShellKind.CommandPrompt];
    const params: TerminalLaunchParams = new TerminalLaunchParams("wsl-Ubuntu", null, new TerminalSize(80, 24), undefined, {}, null, "tool auth login", false, kinds);
    kinds.push(TerminalShellKind.Wsl);

    Expect.same(["PowerShell", "CommandPrompt"], params.shellKinds);
    Expect.same(["PowerShell", "CommandPrompt"], params.toJson()["shellKinds"]);
    Expect.same(params, TerminalLaunchParams.fromJson(params.toJson()));
    Expect.same([], new TerminalLaunchParams(null, null, new TerminalSize(80, 24)).shellKinds);
    Assert.areEqual(false, "shellKinds" in new TerminalLaunchParams(null, null, new TerminalSize(80, 24)).toJson());
  }

  @TestMethod
  public refusesAShellKindThatIsntOneNamingItsIndex(): void {
    const wire: Record<string, unknown> = { ...new TerminalLaunchParams(null, null, new TerminalSize(80, 24)).toJson() };

    Expect.throwsMatching(() => new TerminalLaunchParams(null, null, new TerminalSize(80, 24), undefined, {}, null, null, true,
      [TerminalShellKind.Bash, "Tcsh" as TerminalShellKind]), { name: "ArgumentException", parameterName: "shellKinds.1" });
    Expect.throwsMatching(() => TerminalLaunchParams.fromJson({ ...wire, shellKinds: ["Tcsh"] }), { name: "JsonException", path: "$.shellKinds.0" });
    Expect.throwsMatching(() => TerminalLaunchParams.fromJson({ ...wire, shellKinds: "Bash" }), { name: "JsonException", path: "$.shellKinds" });
  }

  @TestMethod
  public keepsItsOwnCopyOfTheVariables(): void {
    const environment: Record<string, string> = { A: "1" };
    const params: TerminalLaunchParams = new TerminalLaunchParams(null, null, new TerminalSize(80, 24), undefined, environment);
    environment["B"] = "2";

    Expect.same({ A: "1" }, params.environment);
  }

  @TestMethod
  public refusesAVariableTheTerminalSetsItselfNamingItButNotItsValue(): void {
    const error: Error = Expect.throwsMatching(() => new TerminalLaunchParams(null, null, new TerminalSize(80, 24), undefined, { COLORTERM: "secret-value" }), { name: "ArgumentException" });
    Assert.isTrue(!error.message.includes("secret-value") && error.message.includes("environment.COLORTERM"), error.message);
    Expect.throwsMatching(() => TerminalLaunchParams.fromJson({ shellId: null, folder: null, size: { cols: 80, rows: 24 }, storedLimit: 104_857_600,
        environment: { NOLDOVA_TERMINAL_NONCE: "x" }, notice: null, command: null, opensTab: true }), { name: "JsonException", path: "$.environment.NOLDOVA_TERMINAL_NONCE" });
  }

  @TestMethod
  public refusesWhatOnlyTheConstructorChecksAsAJsonExceptionAtTheFieldsPathWhenItReadsThem(): void {
    const wire: Record<string, unknown> = { ...new TerminalLaunchParams(null, null, new TerminalSize(80, 24)).toJson() };
    const many: Record<string, string> = Object.fromEntries(Array.from({ length: 257 }, (_, index) => [`V${index}`, ""]));

    Expect.throwsMatching(() => TerminalLaunchParams.fromJson({ ...wire, folder: "work" }), { name: "JsonException", path: "$.folder" });
    Expect.throwsMatching(() => TerminalLaunchParams.fromJson({ ...wire, environment: { "1A": "x" } }), { name: "JsonException", path: "$.environment" });
    Expect.throwsMatching(() => TerminalLaunchParams.fromJson({ ...wire, environment: { Path: "a", PATH: "b" } }), { name: "JsonException", path: "$.environment.PATH" });
    Expect.throwsMatching(() => TerminalLaunchParams.fromJson({ ...wire, environment: many }), { name: "JsonException", path: "$.environment" });
    Expect.throwsMatching(() => TerminalLaunchParams.fromJson({ ...wire, environment: { A: "x".repeat(32_767), B: "x".repeat(32_767), C: "x".repeat(32_767),
      D: "x".repeat(32_767), E: "x" } }), { name: "JsonException", path: "$.environment" });
    Expect.throwsMatching(() => TerminalLaunchParams.fromJson({ ...wire, command: "echo \u0007" }), { name: "JsonException", path: "$.command" });
  }

  @TestMethod
  public refusesAVariableWhoseValueIsntAStringNamingItsPath(): void {
    Expect.throwsMatching(() => TerminalLaunchParams.fromJson({ shellId: null, folder: null, size: { cols: 80, rows: 24 }, storedLimit: 104_857_600,
        environment: { TOKEN: 7 }, notice: null, command: null, opensTab: true }), { name: "JsonException", path: "$.environment.TOKEN" });
  }

  @TestMethod
  public refusesABlankOrOverLongNoticeAndABlankShellARelativeFolderOrALimitOutOfRange(): void {
    for (const notice of ["", " \n ", "n".repeat(4_097)])
      Expect.throwsMatching(() => new TerminalLaunchParams(null, null, new TerminalSize(80, 24), undefined, {}, notice), { name: "ArgumentException", parameterName: "notice" });
    Assert.areEqual(4_096, new TerminalLaunchParams(null, null, new TerminalSize(80, 24), undefined, {}, "n".repeat(4_096)).notice?.length);
    Expect.throwsMatching(() => new TerminalLaunchParams(" ", null, new TerminalSize(80, 24)), { name: "ArgumentException", parameterName: "shellId" });
    Expect.throwsMatching(() => new TerminalLaunchParams(null, "work", new TerminalSize(80, 24)), { name: "ArgumentException", parameterName: "folder" });
    Expect.throwsMatching(() => new TerminalLaunchParams(null, null, new TerminalSize(80, 24), 1), { name: "ArgumentOutOfRangeException", parameterName: "storedLimit" });
  }

  @TestMethod
  public refusesABlankOrOverLongCommandAndOneHoldingALineBreakATabOrAnotherControlCharacter(): void {
    for (const command of ["", "   ", "c".repeat(16_385), "npm install\nnpm test", "echo a\r", "echo\ta", "echo \u001b[31m", "echo \u0000",
      "echo \u007f", "echo \u009b"])
      Expect.throwsMatching(() => new TerminalLaunchParams(null, null, new TerminalSize(80, 24), undefined, {}, null, command), { name: "ArgumentException", parameterName: "command" });
    Assert.areEqual(16_384, new TerminalLaunchParams(null, null, new TerminalSize(80, 24), undefined, {}, null, "c".repeat(16_384)).command?.length);
    Assert.areEqual("echo \"é\" 😀", new TerminalLaunchParams(null, null, new TerminalSize(80, 24), undefined, {}, null, "echo \"é\" 😀").command);
  }

  @TestMethod
  public refusesAMissingOrUnknownField(): void {
    Expect.throwsMatching(() => TerminalLaunchParams.fromJson({ shellId: null, folder: null, size: { cols: 80, rows: 24 }, storedLimit: 104_857_600, notice: null }), { name: "JsonException", path: "$.environment" });
    Expect.throwsMatching(() => TerminalLaunchParams.fromJson({ shellId: null, folder: null, size: { cols: 80, rows: 24 }, storedLimit: 104_857_600, environment: {},
      notice: null }), { name: "JsonException", path: "$.command" });
    Expect.throwsMatching(() => TerminalLaunchParams.fromJson({ shellId: null, folder: null, size: { cols: 80, rows: 24 }, storedLimit: 104_857_600, environment: {},
      notice: null, command: null }), { name: "JsonException", path: "$.opensTab" });
    Expect.throwsMatching(() => TerminalLaunchParams.fromJson({ shellId: null, folder: null, size: { cols: 80, rows: 24 }, storedLimit: 104_857_600, environment: {},
        notice: null, command: null, opensTab: true, owner: null }), { name: "JsonException", path: "$.owner" });
  }
}
