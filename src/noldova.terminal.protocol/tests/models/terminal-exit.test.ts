/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/context.exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { EndedBy, TerminalExit } from "@noldova/terminal.protocol";

import { Expect } from "../support/expect.ts";

@TestClass
export class TerminalExitTests {
  @TestMethod
  public writesAndReadsAnExitCode(): void {
    const exit: TerminalExit = TerminalExit.fromJson({ exitCode: 3, endedBy: "Exit" });

    Assert.areEqual(3, exit.exitCode);
    Assert.areEqual(EndedBy.Exit, exit.endedBy);
    Expect.same({ exitCode: 0, endedBy: "Exit" }, new TerminalExit(0, EndedBy.Exit).toJson());
  }

  @TestMethod
  public writesAndReadsAnUnknownExitCodeAsNull(): void {
    Assert.areEqual(null, TerminalExit.fromJson({ exitCode: null, endedBy: "Close" }).exitCode);
    Expect.same({ exitCode: null, endedBy: "Close" }, new TerminalExit(null, EndedBy.Close).toJson());
  }

  @TestMethod
  public refusesAFractionalExitCode(): void {
    Assert.throws(() => new TerminalExit(1.5, EndedBy.Exit), ArgumentException);
  }

  @TestMethod
  public refusesAnUnknownEnding(): void {
    Expect.throwsMatching(() => TerminalExit.fromJson({ exitCode: 0, endedBy: "Crash" }), { name: "JsonException", path: "$.endedBy" });
  }

  @TestMethod
  public takesExitCodesFromTheLowestSignedToTheHighestUnsigned32BitNumberAndRefusesOneBeyondThem(): void {
    for (const exitCode of [-2_147_483_648, 4_294_967_295])
      Assert.areEqual(exitCode, new TerminalExit(exitCode, EndedBy.Exit).exitCode);
    for (const exitCode of [-2_147_483_649, 4_294_967_296])
      Expect.throwsMatching(() => new TerminalExit(exitCode, EndedBy.Exit), { name: "ArgumentOutOfRangeException", parameterName: "exitCode" });
  }
}
