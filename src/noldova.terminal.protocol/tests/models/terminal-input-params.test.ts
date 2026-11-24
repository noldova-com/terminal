/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/context.exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { TerminalInputParams } from "../../src/models/terminal-input-params.ts";
import { Expect } from "../support/expect.ts";

@TestClass
export class TerminalInputParamsTests {
  @TestMethod
  public writesAndReadsItsWireFormControlCharactersIncluded(): void {
    const params: TerminalInputParams = TerminalInputParams.fromJson({ sessionId: "s1", data: "ls\r\u0003" });

    Assert.areEqual("ls\r\u0003", params.data);
    Expect.same({ sessionId: "s1", data: "" }, new TerminalInputParams("s1", "").toJson());
  }

  @TestMethod
  public refusesMoreThan1MiBOfInput(): void {
    const data: string = "a".repeat(1_048_577);

    Assert.throws(() => new TerminalInputParams("s1", data), ArgumentException);
    Expect.throwsMatching(() => TerminalInputParams.fromJson({ sessionId: "s1", data }), { name: "JsonException", path: "$.data" });
  }

  @TestMethod
  public refusesABlankSession(): void {
    for (const id of ["", " "])
      Expect.throwsMatching(() => new TerminalInputParams(id, "ls"), { name: "ArgumentException", parameterName: "sessionId" });
  }
}
