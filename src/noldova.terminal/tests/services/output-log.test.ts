/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import type { Registration } from "@noldova/desktop.runtime";
import { describe, it } from "vitest";

import { OutputLog } from "../../src/services/output-log.ts";
import { OutputChunk } from "../../src/tools/models/output-chunk.ts";

describe("OutputLog", () => {
  it("keeps the text without escapes and reads it from an offset", () => {
    const log: OutputLog = new OutputLog();

    log.append("\u001b[32mone\u001b[0m\r\n");
    log.append("\u001b[K");
    log.append("two");

    assert.equal(log.endOffset, 7);
    assert.deepEqual(log.readSince(0), new OutputChunk("one\ntwo", 7));
    assert.deepEqual(log.readSince(4), new OutputChunk("two", 7));
    assert.equal(log.readRange(1, 5), "ne\nt");
  });

  it("keeps only the latest text, and still counts from the start", () => {
    const log: OutputLog = new OutputLog(2);

    log.append("abcd");
    assert.deepEqual(log.readSince(0), new OutputChunk("abcd", 4));
    log.append("ef");

    assert.equal(log.endOffset, 6);
    assert.deepEqual(log.readSince(0), new OutputChunk("ef", 6));
    assert.equal(log.readRange(0, 1), "");
  });

  it("tells a password prompt on the last line", () => {
    const log: OutputLog = new OutputLog();

    log.append("Password: ok\n");
    assert.equal(log.isAwaitingSecret, false);
    log.append("[sudo] password for a: ");
    assert.equal(log.isAwaitingSecret, true);
    log.append("\nEnter passphrase for key '/k':");
    assert.equal(log.isAwaitingSecret, true);
  });

  it("tells its listeners the text it adds, until they leave", () => {
    const log: OutputLog = new OutputLog();
    const texts: string[] = [];
    const subscription: Registration = log.subscribe(t => texts.push(t));

    log.append("\u001b[1ma\u001b[0m");
    log.append("\u001b[0m");
    subscription[Symbol.dispose]();
    log.append("b");

    assert.deepEqual(texts, ["a"]);
  });
});
