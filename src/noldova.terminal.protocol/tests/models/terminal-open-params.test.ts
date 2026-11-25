/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/context.exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { TerminalOpenParams, TerminalSize } from "@noldova/terminal.protocol";

import { Expect } from "../support/expect.ts";

@TestClass
export class TerminalOpenParamsTests {
  @TestMethod
  public writesAndReadsItsWireForm(): void {
    const json: object = { shellId: "bash", folder: "/work/project", size: { cols: 100, rows: 40 }, storedLimit: 20_971_520, isPanelTerminal: true,
      owner: null };
    const params: TerminalOpenParams = TerminalOpenParams.fromJson(json);

    Assert.areEqual("bash", params.shellId);
    Assert.areEqual("/work/project", params.folder);
    Assert.areEqual(100, params.size.columns);
    Assert.areEqual(20_971_520, params.storedLimit);
    Assert.areEqual(true, params.isPanelTerminal);
    Expect.same(json, new TerminalOpenParams("bash", "/work/project", new TerminalSize(100, 40), 20_971_520, true).toJson());
  }

  @TestMethod
  public leavesTheShellAndTheFolderToTheRuntimeWhenTheyAreNullStores100MiBAndOpensATabsTerminalUnlessToldOtherwise(): void {
    const json: object = { shellId: null, folder: null, size: { cols: 80, rows: 24 }, storedLimit: 104_857_600, isPanelTerminal: false, owner: null };
    const params: TerminalOpenParams = TerminalOpenParams.fromJson({ shellId: null, folder: null, size: { cols: 80, rows: 24 }, storedLimit: 104_857_600 });

    Assert.areEqual(null, params.shellId);
    Assert.areEqual(null, params.folder);
    Assert.areEqual(false, params.isPanelTerminal);
    Assert.areEqual(null, params.owner);
    Expect.same(json, params.toJson());
    Expect.same(json, new TerminalOpenParams(null, null, new TerminalSize(80, 24)).toJson());
  }

  @TestMethod
  public tiesATabsTerminalToAnOwner(): void {
    const json: object = { shellId: null, folder: null, size: { cols: 80, rows: 24 }, storedLimit: 104_857_600, isPanelTerminal: false,
      owner: "example.chat/42" };

    Assert.areEqual("example.chat/42", TerminalOpenParams.fromJson(json).owner);
    Expect.same(json, new TerminalOpenParams(null, null, new TerminalSize(80, 24), 104_857_600, false, "example.chat/42").toJson());
    Assert.areEqual(256, new TerminalOpenParams(null, null, new TerminalSize(80, 24), 104_857_600, false, "o".repeat(256)).owner?.length);
  }

  @TestMethod
  public refusesABlankOrOverLongOwnerAndAnOwnerForAPanelTerminal(): void {
    for (const owner of ["", " ", "o".repeat(257)])
      Expect.throwsMatching(() => new TerminalOpenParams(null, null, new TerminalSize(80, 24), 104_857_600, false, owner), { name: "ArgumentException", parameterName: "owner" });
    Expect.throwsMatching(() => new TerminalOpenParams(null, null, new TerminalSize(80, 24), 104_857_600, true, "example.chat/42"), { name: "ArgumentException", parameterName: "owner", message: "A panel terminal has no owner. (Parameter 'owner')" });
    Expect.throwsMatching(() => TerminalOpenParams.fromJson({ shellId: null, folder: null, size: { cols: 80, rows: 24 }, storedLimit: 104_857_600, owner: 42 }), { name: "JsonException", path: "$.owner" });
  }

  @TestMethod
  public refusesABlankShellOrFolder(): void {
    Assert.throws(() => new TerminalOpenParams(" ", null, new TerminalSize(80, 24)), ArgumentException);
    Assert.throws(() => new TerminalOpenParams("bash", "", new TerminalSize(80, 24)), ArgumentException);
  }

  @TestMethod
  public refusesARelativeFolderNamingTheFieldWhenItReadsOne(): void {
    Expect.throwsMatching(() => new TerminalOpenParams(null, "work", new TerminalSize(80, 24)), { name: "ArgumentException", parameterName: "folder" });
    Expect.throwsMatching(() => TerminalOpenParams.fromJson({ shellId: null, folder: "work", size: { cols: 80, rows: 24 }, storedLimit: 104_857_600 }), { name: "JsonException", path: "$.folder", message: "$.folder: The value must be an absolute path. (Parameter 'folder')" });
  }

  @TestMethod
  public refusesABlankOwnerAndAnOwnerForAPanelTerminalAtTheOwnersFieldWhenItReadsThem(): void {
    const json: object = { shellId: null, folder: null, size: { cols: 80, rows: 24 }, storedLimit: 104_857_600 };

    Expect.throwsMatching(() => TerminalOpenParams.fromJson({ ...json, owner: " " }), { name: "JsonException", path: "$.owner" });
    Expect.throwsMatching(() => TerminalOpenParams.fromJson({ ...json, isPanelTerminal: true, owner: "example.chat/42" }), { name: "JsonException", path: "$.owner", message: "$.owner: A panel terminal has no owner. (Parameter 'owner')" });
  }

  @TestMethod
  public storesFrom10MiBTo10000MiB(): void {
    for (const limit of [10_485_760, 10_485_760_000])
      Assert.areEqual(limit, new TerminalOpenParams(null, null, new TerminalSize(80, 24), limit).storedLimit);
    for (const limit of [10_485_759, 10_485_760_001, 10_485_760.5])
      Expect.throwsMatching(() => new TerminalOpenParams(null, null, new TerminalSize(80, 24), limit), { name: "ArgumentOutOfRangeException", parameterName: "storedLimit" });
    Expect.throwsMatching(() => TerminalOpenParams.fromJson({ shellId: null, folder: null, size: { cols: 80, rows: 24 }, storedLimit: 1 }), { name: "JsonException", path: "$.storedLimit" });
  }

  @TestMethod
  public namesTheNestedFieldItCannotRead(): void {
    Expect.throwsMatching(() => TerminalOpenParams.fromJson({ shellId: "bash", folder: "/", size: { cols: 80 }, storedLimit: 104_857_600 }), { name: "JsonException", path: "$.size.rows" });
  }
}
