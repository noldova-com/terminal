/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/context.exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { TerminalTitle } from "../../src/models/terminal-title.ts";
import { Expect } from "../support/expect.ts";

@TestClass
export class TerminalTitleTests {
  @TestMethod
  public writesAndReadsItsWireForm(): void {
    Assert.areEqual("vim notes.txt", TerminalTitle.fromJson({ sessionId: "s1", title: "vim notes.txt" }).title);
    Expect.same({ sessionId: "s1", title: "" }, new TerminalTitle("s1", "").toJson());
  }

  @TestMethod
  public refusesATitleLongerThan4096Characters(): void {
    Assert.throws(() => new TerminalTitle("s1", "t".repeat(4097)), ArgumentException);
    Expect.throwsMatching(() => TerminalTitle.fromJson({ sessionId: "s1", title: "t".repeat(4097) }), { name: "JsonException", path: "$.title" });
  }

  @TestMethod
  public refusesABlankSession(): void {
    for (const id of ["", " "])
      Expect.throwsMatching(() => new TerminalTitle(id, "bash"), { name: "ArgumentException", parameterName: "sessionId" });
  }
}
