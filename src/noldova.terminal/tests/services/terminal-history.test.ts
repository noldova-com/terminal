/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { existsSync, mkdirSync, type PathLike, type RmOptions, statSync, truncateSync, writeFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { JsonException } from "@noldova/context.json";
import { Resources as ProtocolResources, TerminalLine, TerminalTextRun, type TerminalLinePage } from "@noldova/terminal.protocol";
import { afterEach, beforeEach, describe, it, vi } from "vitest";

import { StoredLinesDamagedException } from "../../src/exceptions/stored-lines-damaged.exception.ts";
import { StoredLinesUnwritableException } from "../../src/exceptions/stored-lines-unwritable.exception.ts";
import { TerminalHistoryPaths } from "../../src/models/terminal-history-paths.ts";
import { TerminalHistory } from "../../src/services/terminal-history.ts";

const removal: { failing: string } = vi.hoisted(() => ({ failing: "" }));

vi.mock("node:fs/promises", async importOriginal => {
  const actual: typeof import("node:fs/promises") = await importOriginal<typeof import("node:fs/promises")>();
  return {
    ...actual,
    rm: (path: PathLike, options?: RmOptions): Promise<void> => path === removal.failing
      ? Promise.reject(Object.assign(new Error(`EBUSY: resource busy or locked, unlink '${String(path)}'`), { code: "EBUSY" }))
      : actual.rm(path, options)
  };
});

function pathsOf(files: readonly [string, string]): TerminalHistoryPaths {
  return new TerminalHistoryPaths(files[0], files[1]);
}

function line(text: string): TerminalLine {
  return new TerminalLine(text, false, text.length === 0 ? [] : [new TerminalTextRun(text.length, -1, -1, 0)]);
}

function numbered(index: number): TerminalLine {
  return line(`line ${String(index).padStart(4, "0")}`);
}

const BYTES: number = Buffer.byteLength(`${JSON.stringify(numbered(0).toJson())}\n`);

describe("TerminalHistory", () => {
  let folder: string = "";

  function files(name: string = "t"): [string, string] {
    return [join(folder, `${name}-1.jsonl`), join(folder, `${name}-2.jsonl`)];
  }

  function create(onWritten: () => void = () => undefined, name: string = "t"): TerminalHistory {
    return new TerminalHistory(pathsOf(files(name)), ProtocolResources.defaultStoredLimit, onWritten);
  }

  beforeEach(async () => {
    folder = await mkdtemp(join(tmpdir(), "terminal-history-"));
  });

  afterEach(async () => {
    await rm(folder, { recursive: true, force: true });
  });

  it("reads pages across the whole history", async () => {
    let written: number = 0;
    const history: TerminalHistory = create(() => { written += 1; });
    for (let index: number = 0; index < 150; index++)
      history.append(line(`line ${index} é日本`));

    const middle: TerminalLinePage = await history.readAsync(70, 20);
    const all: TerminalLinePage = await history.readAsync(0, 500);
    const tail: TerminalLinePage = await history.readAsync(149, 10);
    const beyond: TerminalLinePage = await history.readAsync(400, 10);

    assert.equal(middle.start, 70);
    assert.deepEqual([middle.lines[0]?.text, middle.lines[19]?.text], ["line 70 é日本", "line 89 é日本"]);
    assert.equal(all.lines.length, 150);
    assert.deepEqual(tail.lines.map(t => t.text), ["line 149 é日本"]);
    assert.deepEqual([beyond.start, beyond.lines.length], [150, 0]);
    assert.deepEqual([all.stored.end, all.stored.dropped], [150, 0]);
    assert.equal(history.backlog, 0);
    assert.ok(written > 0);
    await history.closeAsync();
  });

  it("reads lines that span read chunks", async () => {
    const history: TerminalHistory = create();
    const long: string = "ж".repeat(900);
    for (let index: number = 0; index < 200; index++)
      history.append(line(`${index} ${long}`));

    const page: TerminalLinePage = await history.readAsync(120, 80);

    assert.equal(page.lines.length, 80);
    assert.equal(page.lines[79]?.text, `199 ${long}`);
    await history.closeAsync();
  });

  it("drops the older file when the newer one fills its half of the limit", async () => {
    const paths: [string, string] = files();
    const history: TerminalHistory = new TerminalHistory(pathsOf(paths), 20 * BYTES, () => undefined);
    for (let index: number = 0; index < 35; index++)
      history.append(numbered(index));

    const all: TerminalLinePage = await history.readAsync(0, 100);
    const across: TerminalLinePage = await history.readAsync(25, 7);

    assert.equal(all.start, 20);
    assert.deepEqual([all.lines[0]?.text, all.lines[14]?.text, all.lines.length], ["line 0020", "line 0034", 15]);
    assert.deepEqual([all.stored.start, all.stored.end, all.stored.dropped], [20, 35, 20]);
    assert.deepEqual(across.lines.map(t => Number(t.text.slice(5))), [25, 26, 27, 28, 29, 30, 31]);
    assert.deepEqual(paths.map(t => statSync(t).size), [10 * BYTES, 5 * BYTES]);
    await history.closeAsync();
  });

  it("goes on storing where removing a dropped file would fail, since a rotation reuses its path and removes no file", async () => {
    const paths: [string, string] = files();
    removal.failing = paths[0];
    const history: TerminalHistory = new TerminalHistory(pathsOf(paths), 4 * BYTES, () => undefined);
    for (let index: number = 0; index < 7; index++)
      history.append(numbered(index));

    const page: TerminalLinePage = await history.readAsync(0, 10);
    removal.failing = "";

    assert.deepEqual([page.start, page.lines.map(t => t.text), page.stored.toJson()], [4, ["line 0004", "line 0005", "line 0006"],
      { start: 4, end: 7, dropped: 4 }]);
    assert.deepEqual(paths.map(t => statSync(t).size), [2 * BYTES, BYTES]);
    await history.closeAsync();
  });

  it("keeps its files within the limit while output never ends", async () => {
    const paths: [string, string] = files();
    const limit: number = 50 * BYTES;
    const history: TerminalHistory = new TerminalHistory(pathsOf(paths), limit, () => undefined);
    let largest: number = 0;
    for (let round: number = 0; round < 20; round++) {
      for (let index: number = 0; index < 97; index++)
        history.append(numbered(round * 97 + index));
      await history.readAsync(0, 1);
      largest = Math.max(largest, paths.filter(t => existsSync(t)).reduce((total, file) => total + statSync(file).size, 0));
    }

    const page: TerminalLinePage = await history.readAsync(0, 500);

    assert.ok(largest <= limit, `${largest} > ${limit}`);
    assert.equal(page.stored.end, 1940);
    assert.equal(page.stored.dropped, page.stored.start);
    assert.equal(page.lines.length, page.stored.end - page.stored.start);
    assert.ok(page.lines.every((t, index) => Number(t.text.slice(5)) === page.start + index));
    await history.closeAsync();
  });

  it("reads a consistent page while lines are dropped during the read", async () => {
    const history: TerminalHistory = new TerminalHistory(pathsOf(files()), 20 * BYTES, () => undefined);
    let next: number = 0;
    const burst = (): void => {
      for (let index: number = 0; index < 25; index++)
        history.append(numbered(next++));
    };
    burst();
    const pages: Promise<TerminalLinePage>[] = [history.readAsync(0, 100), history.readAsync(0, 100), history.readAsync(0, 100)];
    let isSettled: boolean = false;
    void Promise.all(pages).then(() => { isSettled = true; });
    while (!isSettled) {
      burst();
      await new Promise(t => setImmediate(t));
    }

    for (const page of await Promise.all(pages)) {
      assert.equal(page.start, page.stored.start);
      assert.equal(page.lines.length, page.stored.end - page.stored.start);
      assert.ok(page.lines.every((t, index) => Number(t.text.slice(5)) === page.start + index));
    }
    await history.closeAsync();
  });

  it("keeps counting after the lines are cleared and forgets what was dropped", async () => {
    const paths: [string, string] = files();
    const history: TerminalHistory = new TerminalHistory(pathsOf(paths), 20 * BYTES, () => undefined);
    for (let index: number = 0; index < 25; index++)
      history.append(numbered(index));
    await history.readAsync(0, 1);
    const dropped: number = history.stored.dropped;
    history.append(line("unwritten"));

    history.clear();
    history.append(line("new 0"));
    history.append(line("new 1"));
    const page: TerminalLinePage = await history.readAsync(0, 10);

    assert.equal(dropped, 10);
    assert.equal(page.start, 26);
    assert.deepEqual(page.lines.map(t => t.text), ["new 0", "new 1"]);
    assert.deepEqual([history.stored.start, history.stored.end, history.stored.dropped], [26, 28, 0]);
    assert.equal(existsSync(paths[1]), false);
    assert.equal(history.backlog, 0);
    await history.closeAsync();
  });

  it("clears an unwritten batch", async () => {
    const history: TerminalHistory = create();

    history.append(line("never written"));
    history.clear();
    const page: TerminalLinePage = await history.readAsync(0, 10);

    assert.deepEqual([page.lines.length, page.stored.start, history.backlog], [0, 1, 0]);
    await history.closeAsync();
  });

  it("writes each line once when a read writes the pending lines", async () => {
    const history: TerminalHistory = create();
    history.append(line("a"));
    const reading: Promise<TerminalLinePage> = history.readAsync(0, 10);
    await Promise.resolve();

    history.append(line("b"));
    const page: TerminalLinePage = await reading;
    history.append(line("c"));
    const later: TerminalLinePage = await history.readAsync(0, 10);

    assert.deepEqual(page.lines.map(t => t.text), ["a", "b"]);
    assert.equal(page.stored.end, 2);
    assert.deepEqual(later.lines.map(t => t.text), ["a", "b", "c"]);
    await history.closeAsync();
  });

  it("removes its files on close", async () => {
    const paths: [string, string] = files();
    const history: TerminalHistory = new TerminalHistory(pathsOf(paths), 20 * BYTES, () => undefined);
    for (let index: number = 0; index < 15; index++)
      history.append(numbered(index));
    await history.readAsync(0, 1);
    history.append(line("pending"));

    await history.closeAsync();
    await create(() => undefined, "never").closeAsync();

    assert.equal(paths.some(t => existsSync(t)), false);
  });

  it("keeps both of its files private while it is open", async context => {
    context.skip(process.platform === "win32", "Windows has no POSIX file modes; the folder's access list keeps the files private there.");
    const paths: [string, string] = files();
    const history: TerminalHistory = new TerminalHistory(pathsOf(paths), 20 * BYTES, () => undefined);
    for (let index: number = 0; index < 15; index++)
      history.append(numbered(index));
    await history.readAsync(0, 1);

    assert.deepEqual(paths.map(t => statSync(t).mode & 0o777), [0o600, 0o600]);
    await history.closeAsync();
  });

  it("stores and clears nothing after it closes", async () => {
    const history: TerminalHistory = create();
    history.append(line("kept"));
    await history.closeAsync();

    history.append(line("late"));
    history.clear();

    assert.deepEqual([history.stored.toJson(), history.backlog], [{ start: 0, end: 1, dropped: 0 }, 0]);
    assert.equal(files().some(t => existsSync(t)), false);
  });

  it("gives each file it can't remove when it closes", async () => {
    const paths: [string, string] = files();
    const history: TerminalHistory = new TerminalHistory(pathsOf(paths), 2 * BYTES, () => undefined);
    history.append(numbered(0));
    history.append(numbered(1));
    for (const path of paths)
      mkdirSync(path);

    const failures: readonly unknown[] = await history.closeAsync();

    assert.deepEqual(failures.map(t => t instanceof Error), [true, true]);
  });

  it("stops storing after a write fails", async () => {
    const written: PromiseWithResolvers<void> = Promise.withResolvers<void>();
    const history: TerminalHistory = new TerminalHistory(new TerminalHistoryPaths(join(folder, "missing", "t-1.jsonl"), join(folder, "missing", "t-2.jsonl")),
      ProtocolResources.defaultStoredLimit, () => written.resolve());

    history.append(line("lost"));
    await written.promise;
    assert.equal(history.backlog, 0);
    history.append(line("ignored"));
    history.clear();
    const error: unknown = await history.readAsync(0, 10).catch((t: unknown) => t);

    assert.ok(error instanceof StoredLinesUnwritableException);
    assert.equal(error.message, "The terminal's stored lines could not be written.");
    assert.ok(error.cause instanceof Error);
    assert.equal(history.stored.end, 1);
    await history.closeAsync();
  });

  it("stores nothing, touches no file, and says its stored lines could not be written, without paths", async () => {
    const history: TerminalHistory = new TerminalHistory(null, ProtocolResources.defaultStoredLimit, () => undefined);

    history.append(line("lost"));
    history.clear();
    const error: unknown = await history.readAsync(0, 10).catch((t: unknown) => t);

    assert.ok(error instanceof StoredLinesUnwritableException);
    assert.equal(error.message, "The terminal's stored lines could not be written.");
    assert.deepEqual([history.stored.toJson(), history.backlog], [{ start: 0, end: 0, dropped: 0 }, 0]);
    assert.deepEqual(await history.closeAsync(), []);
  });

  it("stops storing when a file cannot be removed", async () => {
    const paths: [string, string] = files();
    mkdirSync(paths[0]);
    const history: TerminalHistory = new TerminalHistory(pathsOf(paths), ProtocolResources.defaultStoredLimit, () => undefined);

    history.clear();
    await assert.rejects(history.readAsync(0, 10), StoredLinesUnwritableException);
    history.append(line("ignored"));

    assert.equal(history.stored.end, 0);
    assert.equal((await history.closeAsync()).length, 1);
  });

  it("reports a damaged file", async () => {
    const paths: [string, string] = files();
    const history: TerminalHistory = create();
    history.append(line("one"));
    history.append(line("two"));
    await history.readAsync(0, 1);

    truncateSync(paths[0], 5);

    await assert.rejects(history.readAsync(0, 2), StoredLinesDamagedException);
    await history.closeAsync();
  });

  it("reports a file whose line isn't a stored line, keeping why as the cause", async () => {
    const paths: [string, string] = files();
    const history: TerminalHistory = create();
    history.append(line("one"));
    await history.readAsync(0, 1);

    writeFileSync(paths[0], `${"x".repeat(BYTES - 1)}\n`);

    await assert.rejects(history.readAsync(0, 1), (error: unknown) => error instanceof StoredLinesDamagedException && error.cause instanceof SyntaxError);
    await history.closeAsync();
  });

  it("reports a file whose line is JSON but not a stored line, keeping the reader's failure as the cause", async () => {
    const paths: [string, string] = files();
    const history: TerminalHistory = create();
    history.append(line("one"));
    await history.readAsync(0, 1);
    const empty: string = JSON.stringify({ other: "" });

    writeFileSync(paths[0], `${JSON.stringify({ other: "x".repeat(BYTES - 1 - empty.length) })}\n`);

    await assert.rejects(history.readAsync(0, 1), (error: unknown) => error instanceof StoredLinesDamagedException && error.cause instanceof JsonException);
    await history.closeAsync();
  });
});
