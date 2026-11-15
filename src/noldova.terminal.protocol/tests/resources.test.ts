/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { Resources } from "../src/resources.ts";

describe("Resources", () => {
  it("formats field and index paths", () => {
    assert.equal(Resources.formatFieldPath("$", "size"), "$.size");
    assert.equal(Resources.formatIndexPath("$.shells", 2), "$.shells[2]");
  });

  it("formats the reader's texts without a path, since JsonException puts the path first", () => {
    assert.equal(Resources.formatLongerThan(9), "Expected at most 9 characters.");
    assert.equal(Resources.formatOutsideRange(0, 9), "Expected a whole number from 0 to 9.");
    assert.equal(Resources.formatMoreItemsThan(2), "Expected at most 2 items.");
    assert.equal(Resources.formatExpectedOneOf(["Exit", "Close"]), "Expected one of Exit, Close.");
  });

  it("formats each argument message with its name", () => {
    assert.equal(Resources.formatNotString("$.a"), "$.a must be a string.");
    assert.equal(Resources.formatBlankString("$.a"), "$.a must not be blank.");
    assert.equal(Resources.formatTooLong("$.a", 9), "$.a must have at most 9 characters.");
    assert.equal(Resources.formatNotIntegerInRange("$.a", 0, 9), "$.a must be a whole number from 0 to 9.");
    assert.equal(Resources.formatNotOneOf("$.a", ["Exit", "Close"]), "$.a must be one of Exit, Close.");
    assert.equal(Resources.formatEnvironmentTooLong("$", 2), "$ must have at most 2 characters of names and values in all.");
    assert.equal(Resources.formatScriptControlCharacter("command"), "command must not hold a control character other than a line break or a tab.");
    assert.equal(Resources.formatScriptHiddenCharacter("command", "\u00ad"),
      "command holds U+00AD, a format or default-ignorable character, which would make it read differently from what runs.");
    assert.equal(Resources.formatScriptHiddenCharacter("command", "\u{e0041}"),
      "command holds U+E0041, a format or default-ignorable character, which would make it read differently from what runs.");
    assert.equal(Resources.formatNotOneLaunchAnswer("$"), "$ must give either sessionId or missingFolder, not both or neither.");
    assert.equal(Resources.formatNotOneRunAnswer("$"), "$ must give a sessionId unless its outcome is NoShell, and none when it is.");
    assert.equal(Resources.formatNotOneRunId("$"), "$ must give a runId when its outcome is Typed, and none when it isn't.");
    assert.equal(Resources.formatTooManyLines("lines", Resources.maximumRunLines), "lines must hold at most 5000 lines.");
  });
});
