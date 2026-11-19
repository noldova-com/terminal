/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { TerminalOpening } from "../../src/models/terminal-opening.ts";

describe("TerminalOpening", () => {
  it("is reached by its own connection, and one without a connection only by the app and only with an owner, as its terminal will be", () => {
    const fromConnection: TerminalOpening = new TerminalOpening(null, 2);
    const owned: TerminalOpening = new TerminalOpening("example.chat/42", null);
    const unowned: TerminalOpening = new TerminalOpening(null, null);

    assert.deepEqual([fromConnection.isReachedBy(2, false), fromConnection.isReachedBy(1, true)], [true, false]);
    assert.deepEqual([owned.isReachedBy(1, true), owned.isReachedBy(1, false), unowned.isReachedBy(1, true)], [true, false, false]);
  });
});
