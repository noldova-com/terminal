/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { ShellOptionsReply } from "../../src/models/shell-options-reply.ts";

describe("ShellOptionsReply", () => {
  it("holds the options the shell gave, not timed out", () => {
    const reply: ShellOptionsReply = new ShellOptionsReply(["-a", "-l"], false);

    assert.deepEqual(reply.options, ["-a", "-l"]);
    assert.equal(reply.isTimedOut, false);
  });

  it("has a reply with no options that did not time out", () => {
    assert.equal(ShellOptionsReply.none.options, null);
    assert.equal(ShellOptionsReply.none.isTimedOut, false);
  });

  it("has a reply with no options that timed out", () => {
    assert.equal(ShellOptionsReply.timedOut.options, null);
    assert.equal(ShellOptionsReply.timedOut.isTimedOut, true);
  });
});
