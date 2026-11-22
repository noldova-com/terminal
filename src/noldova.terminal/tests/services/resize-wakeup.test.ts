/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { ResizeWakeup } from "../../src/services/resize-wakeup.ts";

const STALL: string = "\u001b[6n\u001b[4;3H";

class WakeupRecorder {
  public readonly writes: string[] = [];
  public readonly wakeup: ResizeWakeup = new ResizeWakeup(t => this.writes.push(t));
}

describe("ResizeWakeup", () => {
  it("sends one Ctrl+G ahead of the next key once the output from a resize stops at the cursor request and move, and none without a key", () => {
    const recorder: WakeupRecorder = new WakeupRecorder();

    recorder.wakeup.watch();
    recorder.wakeup.receive("\u001b[6n");
    recorder.wakeup.receive("\u001b[4;3H");
    const beforeKey: readonly string[] = [...recorder.writes];
    recorder.wakeup.beforeInput();
    recorder.wakeup.beforeInput();

    assert.deepEqual([beforeKey, recorder.writes], [[], ["\u0007"]]);
  });

  it("takes control sequences ahead of the request, and a sequence split across chunks", () => {
    const recorder: WakeupRecorder = new WakeupRecorder();

    recorder.wakeup.watch();
    recorder.wakeup.receive("\u001b[?25l\u001b");
    recorder.wakeup.receive("[6n\u001b[12;");
    recorder.wakeup.receive("40H");
    recorder.wakeup.beforeInput();

    assert.deepEqual(recorder.writes, ["\u0007"]);
  });

  it("sends nothing when the prompt is redrawn in the same chunk or a later one", () => {
    const sameChunk: WakeupRecorder = new WakeupRecorder();
    const later: WakeupRecorder = new WakeupRecorder();

    sameChunk.wakeup.watch();
    sameChunk.wakeup.receive(`${STALL}\r$ `);
    later.wakeup.watch();
    later.wakeup.receive(STALL);
    later.wakeup.receive("\u001b[K\r$ ");
    sameChunk.wakeup.beforeInput();
    later.wakeup.beforeInput();

    assert.deepEqual([sameChunk.writes, later.writes], [[], []]);
  });

  it("sends one Ctrl+G for a key that comes after the request and before the move, or part of it, and none for the key after it", () => {
    const requested: WakeupRecorder = new WakeupRecorder();
    const partlyMoved: WakeupRecorder = new WakeupRecorder();

    requested.wakeup.watch();
    requested.wakeup.receive("\u001b[6n");
    requested.wakeup.beforeInput();
    requested.wakeup.receive("\u001b[4;3H");
    requested.wakeup.beforeInput();
    partlyMoved.wakeup.watch();
    partlyMoved.wakeup.receive("\u001b[6n\u001b[4;");
    partlyMoved.wakeup.beforeInput();

    assert.deepEqual([requested.writes, partlyMoved.writes], [["\u0007"], ["\u0007"]]);
  });

  it("sends nothing for a key that comes before the request, or after another sequence follows it", () => {
    const early: WakeupRecorder = new WakeupRecorder();
    const followed: WakeupRecorder = new WakeupRecorder();

    early.wakeup.watch();
    early.wakeup.receive("\u001b[?25l");
    early.wakeup.beforeInput();
    followed.wakeup.watch();
    followed.wakeup.receive("\u001b[6n\u001b[?25h");
    followed.wakeup.beforeInput();

    assert.deepEqual([early.writes, followed.writes], [[], []]);
  });

  it("sends nothing once stopped, or without a resize to watch", () => {
    const stopped: WakeupRecorder = new WakeupRecorder();
    const unwatched: WakeupRecorder = new WakeupRecorder();

    stopped.wakeup.watch();
    stopped.wakeup.receive(STALL);
    stopped.wakeup.stop();
    unwatched.wakeup.receive(STALL);
    stopped.wakeup.beforeInput();
    unwatched.wakeup.beforeInput();

    assert.deepEqual([stopped.writes, unwatched.writes], [[], []]);
  });

  it("watches again from a later resize, after output that ended the last watch", () => {
    const recorder: WakeupRecorder = new WakeupRecorder();

    recorder.wakeup.watch();
    recorder.wakeup.receive("$ ");
    recorder.wakeup.receive(STALL);
    recorder.wakeup.beforeInput();
    const afterRedraw: readonly string[] = [...recorder.writes];
    recorder.wakeup.watch();
    recorder.wakeup.receive(STALL);
    recorder.wakeup.beforeInput();

    assert.deepEqual([afterRedraw, recorder.writes], [[], ["\u0007"]]);
  });
});
