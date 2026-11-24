/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TestClass, TestMethod } from "@noldova/context.testing";

import { TerminalLinesParams } from "../../src/models/terminal-lines-params.ts";
import { Expect } from "../support/expect.ts";

@TestClass
export class TerminalLinesParamsTests {
  @TestMethod
  public writesAndReadsItsWireForm(): void {
    const json: object = { sessionId: "s1", start: 1500, limit: 200 };
    const params: TerminalLinesParams = TerminalLinesParams.fromJson(json);

    Expect.same(["s1", 1500, 200], [params.sessionId, params.start, params.limit]);
    Expect.same(json, params.toJson());
  }

  @TestMethod
  public asksForOneLineTo500LinesFromLine0On(): void {
    Expect.same([0, 500], [new TerminalLinesParams("s1", 0, 1).start, new TerminalLinesParams("s1", 0, 500).limit]);
  }

  @TestMethod
  public refusesABlankSessionANegativeOrFractionalStartAndALimitOutsideOneTo500(): void {
    Expect.throwsMatching(() => new TerminalLinesParams(" ", 0, 10), { name: "ArgumentException", parameterName: "sessionId" });
    for (const start of [-1, 0.5])
      Expect.throwsMatching(() => new TerminalLinesParams("s1", start, 10), { name: "ArgumentOutOfRangeException", parameterName: "start" });
    for (const limit of [0, 501, 2.5])
      Expect.throwsMatching(() => new TerminalLinesParams("s1", 0, limit), { name: "ArgumentOutOfRangeException", parameterName: "limit" });
  }

  @TestMethod
  public namesTheFieldItCannotRead(): void {
    Expect.throwsMatching(() => TerminalLinesParams.fromJson({ sessionId: "s1", start: 0, limit: "all" }), { name: "JsonException", path: "$.limit" });
  }
}
