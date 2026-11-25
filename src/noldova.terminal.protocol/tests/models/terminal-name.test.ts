/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/context.exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { TerminalName } from "@noldova/terminal.protocol";

import { Expect } from "../support/expect.ts";

@TestClass
export class TerminalNameTests {
  @TestMethod
  public writesAndReadsANameAndItsClearing(): void {
    Expect.same({ sessionId: "s1", name: "Server" }, TerminalName.fromJson({ sessionId: "s1", name: "Server" }).toJson());
    Assert.areEqual(null, TerminalName.fromJson({ sessionId: "s1", name: null }).name);
    Expect.same({ sessionId: "s1", name: null }, new TerminalName("s1", null).toJson());
  }

  @TestMethod
  public refusesABlankOrTooLongNameAMissingOneAndAnUnknownField(): void {
    Assert.throws(() => new TerminalName("s1", " "), ArgumentException);
    Assert.throws(() => new TerminalName("s1", "n".repeat(4097)), ArgumentException);
    Expect.throwsMatching(() => TerminalName.fromJson({ sessionId: "s1", name: " " }), { name: "JsonException", path: "$.name" });
    Expect.throwsMatching(() => TerminalName.fromJson({ sessionId: "s1", name: "n".repeat(4097) }), { name: "JsonException", path: "$.name" });
    Expect.throwsMatching(() => TerminalName.fromJson({ sessionId: "s1" }), { name: "JsonException", path: "$.name" });
    Expect.throwsMatching(() => TerminalName.fromJson({ sessionId: "s1", name: null, title: "x" }), { name: "JsonException", path: "$.title" });
  }
}
