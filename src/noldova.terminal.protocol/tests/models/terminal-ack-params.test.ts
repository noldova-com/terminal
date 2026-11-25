/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/context.exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { TerminalAckParams } from "@noldova/terminal.protocol";

import { Expect } from "../support/expect.ts";

@TestClass
export class TerminalAckParamsTests {
  @TestMethod
  public writesAndReadsItsWireForm(): void {
    const params: TerminalAckParams = TerminalAckParams.fromJson({ sessionId: "s1", paneId: "p1", offset: 65_536 });

    Assert.areEqual(65_536, params.offset);
    Expect.same({ sessionId: "s1", paneId: "p1", offset: 0 }, new TerminalAckParams("s1", "p1", 0).toJson());
  }

  @TestMethod
  public refusesANegativeOffset(): void {
    Assert.throws(() => new TerminalAckParams("s1", "p1", -1), ArgumentException);
    Expect.throwsMatching(() => TerminalAckParams.fromJson({ sessionId: "s1", paneId: "p1", offset: -1 }), { name: "JsonException", path: "$.offset" });
  }

  @TestMethod
  public refusesABlankSessionOrPane(): void {
    for (const id of ["", " "])
      Expect.throwsMatching(() => new TerminalAckParams(id, "p1", 0), { name: "ArgumentException", parameterName: "sessionId" });
    for (const id of ["", " "])
      Expect.throwsMatching(() => new TerminalAckParams("s1", id, 0), { name: "ArgumentException", parameterName: "paneId" });
  }
}
