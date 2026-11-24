/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { TerminalRestoreParams } from "../../src/models/terminal-restore-params.ts";
import { TerminalSize } from "../../src/models/terminal-size.ts";
import { Expect } from "../support/expect.ts";

@TestClass
export class TerminalRestoreParamsTests {
  @TestMethod
  public writesAndReadsItsWireForm(): void {
    const json: object = { size: { cols: 100, rows: 40 }, shellId: "zsh", storedLimit: 20_971_520 };
    const params: TerminalRestoreParams = TerminalRestoreParams.fromJson(json);

    Expect.same([100, "zsh", 20_971_520], [params.size.columns, params.shellId, params.storedLimit]);
    Expect.same(json, new TerminalRestoreParams(new TerminalSize(100, 40), "zsh", 20_971_520).toJson());
  }

  @TestMethod
  public leavesAGoneShellToTheRuntimesDefaultAndStores100MiBUnlessToldOtherwise(): void {
    Expect.same({ size: { cols: 80, rows: 24 }, shellId: null, storedLimit: 104_857_600 }, new TerminalRestoreParams(new TerminalSize(80, 24)).toJson());
    Assert.areEqual(null, TerminalRestoreParams.fromJson({ size: { cols: 80, rows: 24 }, shellId: null, storedLimit: 104_857_600 }).shellId);
  }

  @TestMethod
  public refusesABlankShellALimitOutOfBoundsAndAMissingSize(): void {
    Expect.throwsMatching(() => new TerminalRestoreParams(new TerminalSize(80, 24), " "), { name: "ArgumentException", parameterName: "shellId" });
    for (const limit of [10_485_759, 10_485_760_001, 10_485_760.5])
      Expect.throwsMatching(() => new TerminalRestoreParams(new TerminalSize(80, 24), null, limit), { name: "ArgumentOutOfRangeException", parameterName: "storedLimit" });
    Expect.throwsMatching(() => TerminalRestoreParams.fromJson({ size: { cols: 80, rows: 24 }, shellId: null, storedLimit: 1 }), { name: "JsonException", path: "$.storedLimit" });
    Expect.throwsMatching(() => TerminalRestoreParams.fromJson({ size: null, shellId: null, storedLimit: 104_857_600 }), { name: "JsonException", path: "$.size" });
    Expect.throwsMatching(() => TerminalRestoreParams.fromJson({ cols: 80, rows: 24 }), { name: "JsonException" });
  }
}
