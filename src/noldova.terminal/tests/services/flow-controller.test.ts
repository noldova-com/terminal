/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { afterEach, beforeEach, describe, it, vi } from "vitest";

import { FlowController } from "../../src/services/flow-controller.ts";

const MEBIBYTE: number = 1_048_576;
const QUARTER: number = 262_144;

class FlowRecorder {
  public readonly calls: string[] = [];

  public create(): FlowController {
    return new FlowController({
      onPause: () => this.calls.push("pause"),
      onResume: () => this.calls.push("resume"),
      onStalled: t => this.calls.push(`stalled ${t}`)
    });
  }
}

describe("FlowController", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("pauses above 1 MiB the mirror has not parsed, and resumes at 256 KiB", () => {
    const recorder: FlowRecorder = new FlowRecorder();
    const flow: FlowController = recorder.create();

    flow.produce(MEBIBYTE);
    assert.deepEqual(recorder.calls, []);
    flow.produce(1);
    flow.produce(1);
    assert.deepEqual([recorder.calls, flow.isPaused], [["pause"], true]);
    flow.acknowledgeMirror(MEBIBYTE + 2 - QUARTER - 1, 0);
    assert.deepEqual(recorder.calls, ["pause"]);
    flow.acknowledgeMirror(1, 0);
    flow.acknowledgeMirror(MEBIBYTE + 2 - QUARTER, 0);

    assert.deepEqual([recorder.calls, flow.isPaused], [["pause", "resume"], false]);
  });

  it("counts the stored lines still to be written with the output the mirror has not parsed", () => {
    const recorder: FlowRecorder = new FlowRecorder();
    const flow: FlowController = recorder.create();

    flow.produce(QUARTER);
    flow.acknowledgeMirror(QUARTER, MEBIBYTE);
    assert.deepEqual(recorder.calls, []);
    flow.acknowledgeStoring(MEBIBYTE + 1);
    assert.deepEqual(recorder.calls, ["pause"]);
    flow.acknowledgeStoring(QUARTER);

    assert.deepEqual(recorder.calls, ["pause", "resume"]);
  });

  it("waits for the slowest visible pane", () => {
    const recorder: FlowRecorder = new FlowRecorder();
    const flow: FlowController = recorder.create();

    flow.attach("p1", 0);
    flow.produce(MEBIBYTE + 1);
    flow.acknowledgeMirror(MEBIBYTE + 1, 0);
    assert.deepEqual(recorder.calls, ["pause"]);
    flow.acknowledge("p1", MEBIBYTE * 2);

    assert.deepEqual(recorder.calls, ["pause", "resume"]);
  });

  it("does not wait for a hidden pane", () => {
    const recorder: FlowRecorder = new FlowRecorder();
    const flow: FlowController = recorder.create();

    flow.attach("p1", 0);
    flow.produce(MEBIBYTE + 1);
    flow.acknowledgeMirror(MEBIBYTE + 1, 0);
    flow.setVisible("p1", false);
    flow.setVisible("p2", false);

    assert.deepEqual(recorder.calls, ["pause", "resume"]);
  });

  it("detaches a pane that stays over 1 MiB behind for 10 seconds", async () => {
    const recorder: FlowRecorder = new FlowRecorder();
    const flow: FlowController = recorder.create();

    flow.attach("p1", 0);
    flow.produce(MEBIBYTE + 1);
    flow.acknowledgeMirror(MEBIBYTE + 1, 0);
    await vi.advanceTimersByTimeAsync(9_999);
    flow.produce(1);
    flow.acknowledgeMirror(MEBIBYTE + 2, 0);
    await vi.advanceTimersByTimeAsync(1);

    assert.deepEqual(recorder.calls, ["pause", "resume", "stalled p1"]);
    assert.equal(flow.detach("p1"), false);
  });

  it("detaches a pane under 1 MiB behind that keeps paused output from resuming for 10 seconds", async () => {
    const recorder: FlowRecorder = new FlowRecorder();
    const flow: FlowController = recorder.create();

    flow.attach("p1", 0);
    flow.produce(2 * QUARTER);
    flow.acknowledgeMirror(2 * QUARTER, MEBIBYTE + 1);
    assert.deepEqual(recorder.calls, ["pause"]);
    flow.acknowledgeStoring(0);
    await vi.advanceTimersByTimeAsync(9_999);
    assert.deepEqual(recorder.calls, ["pause"]);
    await vi.advanceTimersByTimeAsync(1);

    assert.deepEqual(recorder.calls, ["pause", "resume", "stalled p1"]);
  });

  it("keeps a pane under 1 MiB behind that lets paused output resume within 10 seconds", async () => {
    const recorder: FlowRecorder = new FlowRecorder();
    const flow: FlowController = recorder.create();

    flow.attach("p1", 0);
    flow.produce(2 * QUARTER);
    flow.acknowledgeMirror(2 * QUARTER, MEBIBYTE + 1);
    flow.acknowledgeStoring(0);
    await vi.advanceTimersByTimeAsync(9_999);
    flow.acknowledge("p1", QUARTER);
    await vi.advanceTimersByTimeAsync(10_000);

    assert.deepEqual(recorder.calls, ["pause", "resume"]);
    assert.equal(flow.detach("p1"), true);
  });

  it("keeps a pane that catches up within 10 seconds", async () => {
    const recorder: FlowRecorder = new FlowRecorder();
    const flow: FlowController = recorder.create();

    flow.attach("p1", 0);
    flow.produce(MEBIBYTE + 1);
    flow.acknowledgeMirror(MEBIBYTE + 1, 0);
    flow.acknowledge("p1", MEBIBYTE);
    await vi.advanceTimersByTimeAsync(10_000);

    assert.deepEqual(recorder.calls, ["pause", "resume"]);
    assert.equal(flow.detach("p1"), true);
  });

  it("ignores acknowledgements from panes it does not know", () => {
    const recorder: FlowRecorder = new FlowRecorder();
    const flow: FlowController = recorder.create();

    flow.produce(MEBIBYTE + 1);
    flow.acknowledge("p9", MEBIBYTE + 1);

    assert.deepEqual(recorder.calls, ["pause"]);
  });

  it("starts a pane again when it attaches again", () => {
    const recorder: FlowRecorder = new FlowRecorder();
    const flow: FlowController = recorder.create();

    flow.attach("p1", 0);
    flow.produce(MEBIBYTE + 1);
    flow.acknowledgeMirror(MEBIBYTE + 1, 0);
    flow.attach("p1", MEBIBYTE + 1);

    assert.deepEqual(recorder.calls, ["pause", "resume"]);
  });

  it("stops every stall timer when disposed", async () => {
    const recorder: FlowRecorder = new FlowRecorder();
    const flow: FlowController = recorder.create();

    flow.attach("p1", 0);
    flow.attach("p2", MEBIBYTE + 1);
    flow.produce(MEBIBYTE + 1);
    flow.acknowledgeMirror(MEBIBYTE + 1, 0);
    flow.dispose();
    await vi.advanceTimersByTimeAsync(10_000);

    assert.deepEqual(recorder.calls, ["pause"]);
  });
});
