/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { JsonException } from "@noldova/context.json";
import { TerminalLine, TerminalTextRun } from "@noldova/terminal.protocol";
import { afterEach, beforeEach, describe, it, type MockInstance, vi } from "vitest";

import { StoredLinesDamagedException } from "../../src/exceptions/stored-lines-damaged.exception.ts";
import { TerminalHistorySegment } from "../../src/services/terminal-history-segment.ts";

function line(text: string): TerminalLine {
  return new TerminalLine(text, false, text.length === 0 ? [] : [new TerminalTextRun(text.length, -1, -1, 0)]);
}

function stored(text: string): string {
  return `${JSON.stringify(line(text).toJson())}\n`;
}

function numbered(index: number): string {
  return `line ${String(index).padStart(4, "0")}`;
}

describe("TerminalHistorySegment", () => {
  let folder: string;
  let segments: TerminalHistorySegment[];

  beforeEach(async () => {
    folder = await mkdtemp(join(tmpdir(), "noldova-terminal-segment-"));
    segments = [];
  });

  afterEach(async () => {
    await Promise.all(segments.map(t => t.closeAsync()));
    await rm(folder, { recursive: true, force: true });
  });

  function create(first: number): TerminalHistorySegment {
    const segment: TerminalHistorySegment = new TerminalHistorySegment(join(folder, "lines-0"), first);
    segments.push(segment);
    return segment;
  }

  function append(segment: TerminalHistorySegment, text: string): number {
    const data: string = stored(text);
    const bytes: number = Buffer.byteLength(data, "utf8");
    segment.append(data, bytes);
    return bytes;
  }

  it("starts empty at its first line, with no batch", () => {
    const segment: TerminalHistorySegment = create(100);

    assert.equal(segment.path, join(folder, "lines-0"));
    assert.equal(segment.first, 100);
    assert.equal(segment.end, 100);
    assert.equal(segment.size, 0);
    assert.equal(segment.hasBatch, false);
  });

  it("counts each appended line and its bytes into its end, its size and its batch", () => {
    const segment: TerminalHistorySegment = create(100);

    const bytes: number = append(segment, "héllo") + append(segment, "world");

    assert.equal(segment.end, 102);
    assert.equal(segment.size, bytes);
    assert.equal(segment.hasBatch, true);
  });

  it("discards its batch and gives back the batch's bytes, keeping its end and size", () => {
    const segment: TerminalHistorySegment = create(0);
    const bytes: number = append(segment, "one") + append(segment, "two");

    assert.equal(segment.discard(), bytes);
    assert.equal(segment.hasBatch, false);
    assert.equal(segment.discard(), 0);
    assert.equal(segment.end, 2);
    assert.equal(segment.size, bytes);
  });

  it("takes its batch as one UTF-8 buffer and empties it", () => {
    const segment: TerminalHistorySegment = create(0);
    append(segment, "héllo");
    append(segment, "world");

    const buffer: Buffer = segment.take();

    assert.equal(buffer.toString("utf8"), stored("héllo") + stored("world"));
    assert.equal(segment.hasBatch, false);
    assert.equal(segment.take().length, 0);
  });

  it("writes each buffer after the last", async () => {
    const segment: TerminalHistorySegment = create(0);
    append(segment, "one");
    await segment.writeAsync(segment.take());
    append(segment, "two");
    await segment.writeAsync(segment.take());

    assert.equal(await readFile(segment.path, "utf8"), stored("one") + stored("two"));
  });

  it("writes into a file only its user can read and write", async context => {
    context.skip(process.platform === "win32", "Windows has no POSIX file modes; the folder's access list keeps the file private there.");
    const segment: TerminalHistorySegment = create(0);
    append(segment, "one");
    await segment.writeAsync(segment.take());

    assert.equal((await stat(segment.path)).mode & 0o777, 0o600);
  });

  it("reads written lines by their numbers from its first line", async () => {
    const segment: TerminalHistorySegment = create(100);
    for (const text of ["one", "two", "three", "four"])
      append(segment, text);
    await segment.writeAsync(segment.take());

    assert.deepEqual(await segment.readAsync(101, 2), [line("two"), line("three")]);
    assert.deepEqual(await segment.readAsync(100, 1), [line("one")]);
    assert.deepEqual(await segment.readAsync(102, 0), []);
  });

  it("reads lines from any block, written in several buffers", async () => {
    const segment: TerminalHistorySegment = create(10);
    for (let index: number = 0; index < 150; index++) {
      append(segment, numbered(index));
      if (index === 69)
        await segment.writeAsync(segment.take());
    }
    await segment.writeAsync(segment.take());

    assert.deepEqual(await segment.readAsync(10 + 62, 4), [62, 63, 64, 65].map(t => line(numbered(t))));
    assert.deepEqual(await segment.readAsync(10 + 128, 3), [128, 129, 130].map(t => line(numbered(t))));
    assert.deepEqual(await segment.readAsync(10 + 149, 1), [line(numbered(149))]);
  });

  it("reads lines that cross the end of one read of the file", async () => {
    const segment: TerminalHistorySegment = create(0);
    const texts: string[] = Array.from({ length: 100 }, (_, index) => `${numbered(index)} ${"x".repeat(1_000)}`);
    for (const text of texts)
      append(segment, text);
    await segment.writeAsync(segment.take());

    assert.deepEqual(await segment.readAsync(58, 10), texts.slice(58, 68).map(t => line(t)));
  });

  it("fails as damaged when it reads past the lines the file holds", async () => {
    const segment: TerminalHistorySegment = create(0);
    append(segment, "one");
    await segment.writeAsync(segment.take());
    append(segment, "two");
    segment.discard();

    await assert.rejects(segment.readAsync(1, 1), StoredLinesDamagedException);
  });

  it("fails as damaged on a stored line that isn't a line, keeping why as the cause, and passes on any other failure", async () => {
    const segment: TerminalHistorySegment = create(0);
    append(segment, "one");
    await segment.writeAsync(segment.take());
    const broken: TypeError = new TypeError("broken");

    const reading: MockInstance<typeof TerminalLine.fromJson> = vi.spyOn(TerminalLine, "fromJson").mockImplementationOnce(() => {
      throw new JsonException("not a line", "text");
    });
    try {
      await assert.rejects(segment.readAsync(0, 1), (error: unknown) => error instanceof StoredLinesDamagedException && error.cause instanceof JsonException);
      reading.mockImplementationOnce(() => {
        throw broken;
      });
      await assert.rejects(segment.readAsync(0, 1), broken);
    }
    finally {
      reading.mockRestore();
    }
  });

  it("removes its file, and closes it first", async () => {
    const segment: TerminalHistorySegment = create(0);
    append(segment, "one");
    await segment.writeAsync(segment.take());

    await segment.removeAsync();
    await segment.closeAsync();

    assert.equal(existsSync(segment.path), false);
  });

  it("removes nothing and fails nothing when it never wrote a file", async () => {
    const segment: TerminalHistorySegment = create(0);

    await segment.removeAsync();

    assert.equal(existsSync(segment.path), false);
  });
});
