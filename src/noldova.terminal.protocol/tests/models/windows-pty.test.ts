/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/context.exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { WindowsPty } from "@noldova/terminal.protocol";

import { Expect } from "../support/expect.ts";

@TestClass
export class WindowsPtyTests {
  @TestMethod
  public writesAndReadsItsWireFormWithTheConptyBackend(): void {
    Expect.same({ backend: "conpty", buildNumber: 26100 }, new WindowsPty(26100).toJson());
    Assert.areEqual(19045, WindowsPty.fromJson({ backend: "conpty", buildNumber: 19045 }).buildNumber);
  }

  @TestMethod
  public refusesANegativeBuildNumber(): void {
    Assert.throws(() => new WindowsPty(-1), ArgumentException);
  }

  @TestMethod
  public refusesAnotherBackend(): void {
    Expect.throwsMatching(() => WindowsPty.fromJson({ backend: "winpty", buildNumber: 17763 }), { name: "JsonException", path: "$.backend" });
  }

  @TestMethod
  public takesBuildNumbersUpToTheLargestA32BitNumberHoldsAndRefusesOneAboveIt(): void {
    Assert.areEqual(4_294_967_295, new WindowsPty(4_294_967_295).buildNumber);
    Expect.throwsMatching(() => new WindowsPty(4_294_967_296), { name: "ArgumentOutOfRangeException", parameterName: "buildNumber" });
  }
}
