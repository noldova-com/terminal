/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { afterEach, beforeEach, describe, it, vi } from "vitest";

import { TerminalInputEdge, TerminalInputMark } from "@noldova/terminal.protocol";

import { OutputBatcher } from "../../src/services/output-batcher.ts";

class BatchRecorder {
  public readonly batches: string[] = [];
  public readonly inputs: string[][] = [];

  public create(): OutputBatcher {
    return new OutputBatcher({
      onBatch: (offset, data, inputs) => {
        this.batches.push(`${offset}:${data.length}:${data.slice(0, 8)}`);
        this.inputs.push(inputs.map(t => `${t.edge}@${t.offset}`));
      }
    });
  }
}

describe("OutputBatcher", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("sends what arrives within 16 ms as one batch, numbered by its offset", async () => {
    const recorder: BatchRecorder = new BatchRecorder();
    const batcher: OutputBatcher = recorder.create();

    batcher.append("ab");
    batcher.append("cd");
    await vi.advanceTimersByTimeAsync(15);
    assert.deepEqual(recorder.batches, []);
    await vi.advanceTimersByTimeAsync(1);
    batcher.append("ef");
    await vi.advanceTimersByTimeAsync(16);

    assert.deepEqual(recorder.batches, ["0:4:abcd", "4:2:ef"]);
  });

  it("gives each batch the input marks up to its end, at their output offsets", async () => {
    const recorder: BatchRecorder = new BatchRecorder();
    const batcher: OutputBatcher = recorder.create();

    batcher.append("$ ", [new TerminalInputMark(2, TerminalInputEdge.Start)]);
    batcher.append("ls\r\n", [new TerminalInputMark(2, TerminalInputEdge.End)]);
    await vi.advanceTimersByTimeAsync(16);
    batcher.append("x".repeat(65_536), [new TerminalInputMark(65_536, TerminalInputEdge.Start)]);
    batcher.append("y".repeat(10), [new TerminalInputMark(0, TerminalInputEdge.End)]);
    await vi.advanceTimersByTimeAsync(16);

    assert.deepEqual(recorder.batches, ["0:6:$ ls\r\n", "6:65536:xxxxxxxx", "65542:10:yyyyyyyy"]);
    assert.deepEqual(recorder.inputs, [["Start@2", "End@4"], ["Start@65542"], ["End@65542"]]);
  });

  it("gives a mark in a later batch of long output to that batch", () => {
    const recorder: BatchRecorder = new BatchRecorder();
    const batcher: OutputBatcher = recorder.create();

    batcher.append("x".repeat(70_000), [new TerminalInputMark(10, TerminalInputEdge.Start), new TerminalInputMark(68_000, TerminalInputEdge.End)]);

    assert.deepEqual(recorder.batches, ["0:65536:xxxxxxxx", "65536:4464:xxxxxxxx"]);
    assert.deepEqual(recorder.inputs, [["Start@10"], ["End@68000"]]);
  });

  it("sends at once when 64 KiB is waiting", () => {
    const recorder: BatchRecorder = new BatchRecorder();
    const batcher: OutputBatcher = recorder.create();

    batcher.append("x".repeat(65_535));
    assert.deepEqual(recorder.batches, []);
    batcher.append("y");

    assert.deepEqual(recorder.batches, ["0:65536:xxxxxxxx"]);
  });

  it("splits long output into batches of 64 KiB", () => {
    const recorder: BatchRecorder = new BatchRecorder();
    const batcher: OutputBatcher = recorder.create();

    batcher.append("x".repeat(150_000));

    assert.deepEqual(recorder.batches, ["0:65536:xxxxxxxx", "65536:65536:xxxxxxxx", "131072:18928:xxxxxxxx"]);
  });

  it("keeps a surrogate pair in one batch", () => {
    const recorder: BatchRecorder = new BatchRecorder();
    const batcher: OutputBatcher = recorder.create();

    batcher.append(`${"x".repeat(65_535)}\u{1f600}${"y".repeat(65_536)}`);
    batcher.append(`${"x".repeat(65_534)}\u{1f600}y`);

    assert.deepEqual(recorder.batches, [
      "0:65535:xxxxxxxx",
      "65535:65536:\u{1f600}yyyyyy",
      "131071:2:yy",
      "131073:65536:xxxxxxxx",
      "196609:1:y"
    ]);
  });

  it("ignores empty output and an empty flush", async () => {
    const recorder: BatchRecorder = new BatchRecorder();
    const batcher: OutputBatcher = recorder.create();

    batcher.append("");
    batcher.flush();
    await vi.advanceTimersByTimeAsync(16);

    assert.deepEqual(recorder.batches, []);
  });

  it("flushes on demand and sends nothing more when the timer would have fired", async () => {
    const recorder: BatchRecorder = new BatchRecorder();
    const batcher: OutputBatcher = recorder.create();

    batcher.append("ab");
    batcher.flush();
    await vi.advanceTimersByTimeAsync(16);

    assert.deepEqual(recorder.batches, ["0:2:ab"]);
  });

  it("sends nothing after it is disposed", async () => {
    const recorder: BatchRecorder = new BatchRecorder();
    const batcher: OutputBatcher = recorder.create();

    batcher.append("ab");
    batcher.dispose();
    batcher.dispose();
    await vi.advanceTimersByTimeAsync(16);

    assert.deepEqual(recorder.batches, []);
  });
});
