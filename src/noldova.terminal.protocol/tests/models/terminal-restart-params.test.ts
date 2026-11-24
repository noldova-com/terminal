/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/context.exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { TerminalRestartParams } from "../../src/models/terminal-restart-params.ts";
import { TerminalSize } from "../../src/models/terminal-size.ts";
import { Expect } from "../support/expect.ts";

@TestClass
export class TerminalRestartParamsTests {
  @TestMethod
  public writesAndReadsItsWireForm(): void {
    const params: TerminalRestartParams = TerminalRestartParams.fromJson({ sessionId: "s1", size: { cols: 132, rows: 50 } });

    Assert.areEqual(132, params.size.columns);
    Expect.same({ sessionId: "s1", size: { cols: 80, rows: 24 } }, new TerminalRestartParams("s1", new TerminalSize(80, 24)).toJson());
  }

  @TestMethod
  public refusesABlankSessionId(): void {
    Assert.throws(() => new TerminalRestartParams("", new TerminalSize(80, 24)), ArgumentException);
    Expect.throwsMatching(() => TerminalRestartParams.fromJson({ sessionId: "s1", size: null }), { name: "JsonException", path: "$.size" });
  }
}
