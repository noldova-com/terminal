/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { Resources } from "../src/resources.ts";

@TestClass
export class ResourcesTests {
  @TestMethod
  public formatsFieldAndIndexPaths(): void {
    Assert.areEqual("$.size", Resources.formatFieldPath("$", "size"));
    Assert.areEqual("$.shells[2]", Resources.formatIndexPath("$.shells", 2));
  }

  @TestMethod
  public formatsTheReadersTextsWithoutAPathSinceJsonExceptionPutsThePathFirst(): void {
    Assert.areEqual("Expected at most 9 characters.", Resources.formatLongerThan(9));
    Assert.areEqual("Expected a whole number from 0 to 9.", Resources.formatOutsideRange(0, 9));
    Assert.areEqual("Expected at most 2 items.", Resources.formatMoreItemsThan(2));
    Assert.areEqual("Expected one of Exit, Close.", Resources.formatExpectedOneOf(["Exit", "Close"]));
  }

  @TestMethod
  public formatsEachArgumentMessageWithItsName(): void {
    Assert.areEqual("$.a must be a string.", Resources.formatNotString("$.a"));
    Assert.areEqual("$.a must not be blank.", Resources.formatBlankString("$.a"));
    Assert.areEqual("$.a must have at most 9 characters.", Resources.formatTooLong("$.a", 9));
    Assert.areEqual("$.a must be a whole number from 0 to 9.", Resources.formatNotIntegerInRange("$.a", 0, 9));
    Assert.areEqual("$.a must be one of Exit, Close.", Resources.formatNotOneOf("$.a", ["Exit", "Close"]));
    Assert.areEqual("$ must have at most 2 characters of names and values in all.", Resources.formatEnvironmentTooLong("$", 2));
    Assert.areEqual("command must not hold a control character other than a line break or a tab.", Resources.formatScriptControlCharacter("command"));
    Assert.areEqual("command holds U+00AD, a format or default-ignorable character, which would make it read differently from what runs.", Resources.formatScriptHiddenCharacter("command", "\u00ad"));
    Assert.areEqual("command holds U+E0041, a format or default-ignorable character, which would make it read differently from what runs.", Resources.formatScriptHiddenCharacter("command", "\u{e0041}"));
    Assert.areEqual("$ must give either sessionId or missingFolder, not both or neither.", Resources.formatNotOneLaunchAnswer("$"));
    Assert.areEqual("$ must give a sessionId unless its outcome is NoShell, and none when it is.", Resources.formatNotOneRunAnswer("$"));
    Assert.areEqual("$ must give a runId when its outcome is Typed, and none when it isn't.", Resources.formatNotOneRunId("$"));
    Assert.areEqual("lines must hold at most 5000 lines.", Resources.formatTooManyLines("lines", Resources.maximumRunLines));
  }
}
