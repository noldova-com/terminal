/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { Resources as ProtocolResources, TerminalSize, type TerminalLine, type TerminalRunOutput } from "@noldova/terminal.protocol";
import { afterEach, beforeEach, describe, it } from "vitest";

import { MirrorLine } from "../../src/models/mirror-line.ts";
import type { MirrorSnapshot } from "../../src/models/mirror-snapshot.ts";
import { TerminalHistoryPaths } from "../../src/models/terminal-history-paths.ts";
import { Resources } from "../../src/resources.ts";
import { TerminalHistory } from "../../src/services/terminal-history.ts";
import { TerminalMirror } from "../../src/services/terminal-mirror.ts";

let folder: string = "";
let histories: number = 0;

class MirrorRecorder {
  public readonly replies: string[] = [];
  public readonly parsed: number[] = [];
  public readonly titles: string[] = [];
  public readonly history: TerminalHistory = MirrorRecorder.createHistory();
  private readonly waiters: (() => void)[] = [];

  public create(columns: number = 80, rows: number = 24): TerminalMirror {
    return new TerminalMirror(new TerminalSize(columns, rows), this.history, {
      onReply: t => this.replies.push(t),
      onParsed: t => {
        this.parsed.push(t);
        for (const waiter of this.waiters.splice(0))
          waiter();
      },
      onTitleChanged: t => this.titles.push(t)
    });
  }

  public nextParsedAsync(): Promise<void> {
    return new Promise<void>(resolve => this.waiters.push(resolve));
  }

  public async readAllAsync(): Promise<TerminalLine[]> {
    const lines: TerminalLine[] = [];
    for (let start: number = this.history.stored.start; start < this.history.stored.end; start += ProtocolResources.maximumPageLines)
      lines.push(...(await this.history.readAsync(start, ProtocolResources.maximumPageLines)).lines);
    return lines;
  }

  private static createHistory(): TerminalHistory {
    histories += 1;
    return new TerminalHistory(new TerminalHistoryPaths(join(folder, `${histories}-1.jsonl`), join(folder, `${histories}-2.jsonl`)), ProtocolResources.defaultStoredLimit,
      () => undefined);
  }
}

function writeAsync(mirror: TerminalMirror, data: string): Promise<MirrorSnapshot> {
  mirror.write(data);
  return mirror.snapshotAsync();
}

function flushAsync(mirror: TerminalMirror): Promise<MirrorSnapshot> {
  return writeAsync(mirror, "\r\n".repeat(2 * (Resources.scrollback + 24)));
}

function at(number: number): MirrorLine {
  return new MirrorLine(number, undefined);
}

async function cursorAsync(mirror: TerminalMirror): Promise<number> {
  return (await mirror.anchorAsync(null)).number;
}

async function textsAsync(mirror: TerminalMirror, start: MirrorLine, end: MirrorLine | null): Promise<readonly string[]> {
  return (await mirror.readLinesAsync(start, end, 100)).lines.map(t => t.text);
}

function joined(lines: readonly TerminalLine[]): string {
  return lines.map(t => (t.isWrapped ? "" : "\n") + t.text).join("").replace(/\n+$/u, "\n");
}

describe("TerminalMirror", () => {
  beforeEach(async () => {
    folder = await mkdtemp(join(tmpdir(), "terminal-mirror-"));
  });

  afterEach(async () => {
    await rm(folder, { recursive: true, force: true });
  });

  it("reports each write as parsed, at the offset after it", async () => {
    const recorder: MirrorRecorder = new MirrorRecorder();
    const mirror: TerminalMirror = recorder.create();

    mirror.write("ab");
    mirror.write("cde");
    await mirror.snapshotAsync();

    assert.deepEqual(recorder.parsed, [2, 5]);
    mirror.dispose();
  });

  it("answers a device attributes query while no window is attached", async () => {
    const recorder: MirrorRecorder = new MirrorRecorder();
    const mirror: TerminalMirror = recorder.create();

    mirror.write("\u001b[c");
    await mirror.snapshotAsync();

    assert.equal(recorder.replies.length, 1);
    assert.match(recorder.replies[0] ?? "", /^\u001b\[\?[\d;]+c$/u);
    mirror.dispose();
  });

  it("answers a cursor position query at its size after a resize", async () => {
    const recorder: MirrorRecorder = new MirrorRecorder();
    const mirror: TerminalMirror = recorder.create();

    mirror.write("x");
    mirror.resize(new TerminalSize(10, 5));
    mirror.write("\u001b[3;99H\u001b[6n");
    await mirror.snapshotAsync();

    assert.deepEqual(recorder.replies, ["\u001b[3;10R"]);
    mirror.dispose();
  });

  it("keeps the title, cut to 4096 characters", async () => {
    const recorder: MirrorRecorder = new MirrorRecorder();
    const mirror: TerminalMirror = recorder.create();

    const titles: string[] = [mirror.title];
    mirror.write("\u001b]0;build\u0007");
    await mirror.snapshotAsync();
    titles.push(mirror.title);
    mirror.write(`\u001b]2;${"t".repeat(5_000)}\u0007`);
    await mirror.snapshotAsync();
    titles.push(mirror.title);

    assert.deepEqual(titles.slice(0, 2), ["", "build"]);
    assert.equal(titles[2]?.length, 4_096);
    assert.deepEqual(recorder.titles.map(t => t.length), [5, 4_096]);
    mirror.dispose();
  });

  it("snapshots the screen with the offset it covers and the unfinished sequence after it", async () => {
    const mirror: TerminalMirror = new MirrorRecorder().create();

    mirror.write("hello\r\nworld\u001b]0;ti");
    const snapshot: MirrorSnapshot = await mirror.snapshotAsync();

    assert.match(snapshot.snapshot, /hello\r\nworld/u);
    assert.equal(snapshot.pending, "\u001b]0;ti");
    assert.equal(snapshot.offset, 18);
    mirror.dispose();
  });

  it("stores the lines that leave the scrollback in order, and keeps the latest rows for a snapshot", async () => {
    const recorder: MirrorRecorder = new MirrorRecorder();
    const mirror: TerminalMirror = recorder.create(20, 5);
    let text: string = "";
    for (let index: number = 1; index <= 2600; index++)
      text += `line ${index}\r\n`;

    const snapshot: MirrorSnapshot = await writeAsync(mirror, text);
    const first: readonly TerminalLine[] = (await recorder.history.readAsync(0, 500)).lines;
    const second: readonly TerminalLine[] = (await recorder.history.readAsync(1500, 500)).lines;

    assert.equal(recorder.history.stored.end, 1596);
    assert.deepEqual([first[0]?.text, first[499]?.text], ["line 1", "line 500"]);
    assert.deepEqual([second[0]?.text, second[95]?.text], ["line 1501", "line 1596"]);
    assert.ok(snapshot.snapshot.includes("line 1597") && snapshot.snapshot.includes("line 2600"));
    assert.equal(snapshot.snapshot.includes("line 1596"), false);
    mirror.dispose();
    await recorder.history.closeAsync();
  });

  it("clears the stored lines when the saved lines are erased or the terminal resets", async () => {
    const recorder: MirrorRecorder = new MirrorRecorder();
    const mirror: TerminalMirror = recorder.create(20, 3);

    for (const clearing of ["\u001b[3J", "\u001b[?3J", "\u001bc"]) {
      await writeAsync(mirror, "old-row\r\n".repeat(1200) + "clear-a\r\nclear-b\r\nclear-c\r\nclear-d\r\n");
      assert.ok(recorder.history.stored.end > recorder.history.stored.start);
      const snapshot: MirrorSnapshot = await writeAsync(mirror, `${clearing}clear-e\r\nclear-f\r\nclear-g\r\nclear-h\r\n`);

      assert.equal((await recorder.history.readAsync(0, 10)).lines.length, 0);
      assert.equal(snapshot.snapshot.includes("old-row"), false);
      assert.equal(snapshot.snapshot.includes("clear-c"), clearing !== "\u001bc");
      assert.ok(snapshot.snapshot.includes("clear-e"));
    }
    await writeAsync(mirror, "\u001b[2J\u001b[1J\u001b[4J");
    assert.equal((await recorder.history.readAsync(0, 10)).lines.length, 0);
    mirror.dispose();
    await recorder.history.closeAsync();
  });

  it("stores nothing of the alternate screen", async () => {
    const recorder: MirrorRecorder = new MirrorRecorder();
    const mirror: TerminalMirror = recorder.create(20, 3);
    await writeAsync(mirror, "normal\r\n".repeat(1100));
    const stored: number = recorder.history.stored.end;

    const snapshot: MirrorSnapshot = await writeAsync(mirror, "\u001b[?1049h" + "alternate\r\n".repeat(20) + "\u001b[3J");
    await writeAsync(mirror, "\u001b[?1049l");

    assert.equal(recorder.history.stored.end, stored);
    assert.equal(recorder.history.stored.start, 0);
    assert.ok(snapshot.snapshot.includes("\u001b[?1049h"));
    mirror.dispose();
    await recorder.history.closeAsync();
  });

  it("starts no line on the alternate screen, so it reads and places none there, and reads one at the normal screen's prompt", async () => {
    const recorder: MirrorRecorder = new MirrorRecorder();
    const mirror: TerminalMirror = recorder.create(20, 3);

    await writeAsync(mirror, "\u001b[?1049h> ");
    mirror.startInput();
    const alternate: MirrorSnapshot = await writeAsync(mirror, "dd");
    const alternateLine: string | null = await mirror.endInput();
    await writeAsync(mirror, "\u001b[?1049l$ ");
    mirror.startInput();
    const normal: MirrorSnapshot = await writeAsync(mirror, "ls");

    assert.deepEqual([alternate.input, alternateLine, normal.input?.column, await mirror.endInput()], [null, null, 2, "ls"]);
    mirror.dispose();
    await recorder.history.closeAsync();
  });

  it("keeps the latest rows when the screen shrinks and grows", async () => {
    const recorder: MirrorRecorder = new MirrorRecorder();
    const mirror: TerminalMirror = recorder.create(20, 5);
    await writeAsync(mirror, "a1\r\na2\r\na3\r\na4\r\na5");

    mirror.resize(new TerminalSize(20, 3));
    await mirror.snapshotAsync();
    const shrunk: number = (await recorder.history.readAsync(0, 10)).lines.length;
    mirror.resize(new TerminalSize(8, 6));
    await writeAsync(mirror, "\r\nlonger line\r\n");
    mirror.resize(new TerminalSize(20, 6));
    const snapshot: MirrorSnapshot = await mirror.snapshotAsync();

    assert.deepEqual([shrunk, (await recorder.history.readAsync(0, 10)).lines.length], [0, 0]);
    assert.ok(snapshot.snapshot.includes("a1") && snapshot.snapshot.includes("a5"));
    mirror.dispose();
    await recorder.history.closeAsync();
  });

  it("gives the same snapshot after narrowing and widening, and stores nothing", async () => {
    const recorder: MirrorRecorder = new MirrorRecorder();
    const restoredRecorder: MirrorRecorder = new MirrorRecorder();
    const mirror: TerminalMirror = recorder.create(80, 5);
    const restored: TerminalMirror = restoredRecorder.create(80, 5);
    const before: MirrorSnapshot = await writeAsync(mirror, "\u001b[31mred-output-with-a-long-line\u001b[0m\r\nwide-界-🙂-output\r\n");

    mirror.resize(new TerminalSize(2, 5));
    mirror.resize(new TerminalSize(80, 5));
    const after: MirrorSnapshot = await writeAsync(restored, (await mirror.snapshotAsync()).snapshot);

    assert.equal(after.snapshot, before.snapshot);
    assert.deepEqual([recorder.history.stored.end, restoredRecorder.history.stored.end], [0, 0]);
    mirror.dispose();
    restored.dispose();
    await recorder.history.closeAsync();
    await restoredRecorder.history.closeAsync();
  });

  it("stores the rows a resize pushes beyond the scrollback without losing or repeating one", async () => {
    const recorder: MirrorRecorder = new MirrorRecorder();
    const mirror: TerminalMirror = recorder.create(20, 5);
    const lines: string[] = Array.from({ length: 500 }, (_t, index) => `line-${String(index).padStart(3, "0")}`);
    await writeAsync(mirror, lines.join("\r\n") + "\r\n");

    mirror.resize(new TerminalSize(2, 5));
    await mirror.snapshotAsync();
    const stored: number = recorder.history.stored.end;
    mirror.resize(new TerminalSize(20, 5));
    await flushAsync(mirror);

    assert.ok(stored > 0);
    assert.equal(joined(await recorder.readAllAsync()), "\n" + lines.join("\n") + "\n");
    mirror.dispose();
    await recorder.history.closeAsync();
  });

  it("stores nothing from a resize xterm runs after the mirror is disposed", async () => {
    const recorder: MirrorRecorder = new MirrorRecorder();
    const mirror: TerminalMirror = recorder.create(20, 5);
    await writeAsync(mirror, Array.from({ length: 500 }, (_t, index) => `line-${String(index).padStart(3, "0")}`).join("\r\n") + "\r\n");

    mirror.resize(new TerminalSize(2, 5));
    const parsed: Promise<void> = recorder.nextParsedAsync();
    mirror.write("");
    mirror.dispose();
    await parsed;

    assert.equal(recorder.history.stored.end, 0);
    await recorder.history.closeAsync();
  });

  it("goes on storing after an alternate screen while its scrollback is full", async () => {
    const recorder: MirrorRecorder = new MirrorRecorder();
    const mirror: TerminalMirror = recorder.create(20, 3);
    const expected: string[] = Array.from({ length: 1100 }, (_t, index) => `normal-${index}`);
    await writeAsync(mirror, expected.join("\r\n") + "\r\n");
    const stored: number = recorder.history.stored.end;

    await writeAsync(mirror, "\u001b[?1049h" + "alternate\r\n".repeat(20) + "\u001b[3J");
    const during: number = recorder.history.stored.end;
    await writeAsync(mirror, "\u001b[?1049lafter-alternate\r\n");
    await flushAsync(mirror);

    assert.equal(during, stored);
    assert.equal(joined(await recorder.readAllAsync()), "\n" + [...expected, "after-alternate"].join("\n") + "\n");
    mirror.dispose();
    await recorder.history.closeAsync();
  });

  it("keeps each line's number while lines leave for the stored history, and gives a range's lines it still holds, counting the rest as cut", async () => {
    const recorder: MirrorRecorder = new MirrorRecorder();
    const mirror: TerminalMirror = recorder.create(20, 5);
    await writeAsync(mirror, "first\r\n");
    const firstCursor: number = await cursorAsync(mirror);
    await writeAsync(mirror, Array.from({ length: 2000 }, (_t, index) => `line ${index + 1}\r\n`).join(""));

    const cursor: number = await cursorAsync(mirror);
    const tail: TerminalRunOutput = await mirror.readLinesAsync(at(1999), null, 10);
    const middle: TerminalRunOutput = await mirror.readLinesAsync(at(1500), at(1502), 10);
    const latest: TerminalRunOutput = await mirror.readLinesAsync(at(0), null, 5);
    const gone: TerminalRunOutput = await mirror.readLinesAsync(at(0), at(3), 10);
    const all: TerminalRunOutput = await mirror.readLinesAsync(at(1), at(2001), 5_000);

    assert.deepEqual([firstCursor, cursor], [1, 2001]);
    assert.deepEqual([tail.lines.map(t => t.text), tail.cutLines], [["line 1999", "line 2000", ""], 0]);
    assert.deepEqual([middle.lines.map(t => t.text), middle.cutLines], [["line 1500", "line 1501"], 0]);
    assert.deepEqual([latest.lines.map(t => t.text), latest.cutLines], [["line 1997", "line 1998", "line 1999", "line 2000", ""], 1997]);
    assert.deepEqual([gone.lines, gone.cutLines], [[], 3]);
    assert.ok(recorder.history.stored.end > 0 && all.cutLines > 0);
    assert.deepEqual([all.cutLines + all.lines.length, all.lines[0]?.text, all.lines.at(-1)?.text], [2000, `line ${all.cutLines + 1}`, "line 2000"]);
    mirror.dispose();
    await recorder.history.closeAsync();
  });

  it("starts a range's lines at a line's start, cutting the continued rows of a longer line its first rows fall in", async () => {
    const recorder: MirrorRecorder = new MirrorRecorder();
    const mirror: TerminalMirror = recorder.create(10, 5);
    await writeAsync(mirror, `x\r\n${"a".repeat(25)}\r\n`);

    const whole: TerminalRunOutput = await mirror.readLinesAsync(at(1), at(4), 10);
    const continued: TerminalRunOutput = await mirror.readLinesAsync(at(2), null, 10);
    const limited: TerminalRunOutput = await mirror.readLinesAsync(at(1), null, 3);

    assert.deepEqual(whole.lines.map(t => [t.text, t.isWrapped]), [["a".repeat(10), false], ["a".repeat(10), true], ["a".repeat(5), true]]);
    assert.deepEqual([continued.lines.map(t => t.text), continued.cutLines], [[""], 2]);
    assert.deepEqual([limited.lines.map(t => t.text), limited.cutLines], [[""], 3]);
    mirror.dispose();
    await recorder.history.closeAsync();
  });

  it("keeps an anchored line on its own line while a resize reflows the lines above it narrower and wider, and a line anchored at another", async () => {
    const recorder: MirrorRecorder = new MirrorRecorder();
    const mirror: TerminalMirror = recorder.create(20, 10);
    await writeAsync(mirror, `${"a".repeat(30)}\r\n`);
    const first: MirrorLine = await mirror.anchorAsync(null);
    await writeAsync(mirror, "run a\r\n");
    const second: MirrorLine = await mirror.anchorAsync(null);
    const copy: MirrorLine = await mirror.anchorAsync(first);
    await writeAsync(mirror, "run b\r\n");
    const numbers: number[][] = [[first.number, second.number]];

    mirror.resize(new TerminalSize(10, 10));
    const narrower: readonly (readonly string[])[] = [
      await textsAsync(mirror, first, second), await textsAsync(mirror, second, null), await textsAsync(mirror, copy, second)
    ];
    numbers.push([first.number, second.number]);
    mirror.resize(new TerminalSize(40, 10));
    const wider: readonly (readonly string[])[] = [
      await textsAsync(mirror, first, second), await textsAsync(mirror, second, null), await textsAsync(mirror, copy, second)
    ];
    numbers.push([first.number, second.number]);
    first.dispose();
    mirror.resize(new TerminalSize(10, 10));
    const late: MirrorLine = await mirror.anchorAsync(first);

    assert.deepEqual(numbers, [[2, 3], [3, 4], [1, 2]]);
    assert.deepEqual([narrower, wider], [[["run a"], ["run b", ""], ["run a"]], [["run a"], ["run b", ""], ["run a"]]]);
    assert.deepEqual([first.number, first.index, copy.number, second.number, late.number, late.index], [1, null, 3, 4, 1, null]);
    mirror.dispose();
    await recorder.history.closeAsync();
  });

  it("anchors no marker on the alternate screen, keeping the normal screen's cursor line by number, across a resize", async () => {
    const recorder: MirrorRecorder = new MirrorRecorder();
    const mirror: TerminalMirror = recorder.create(20, 10);
    await writeAsync(mirror, "a\r\nb\r\n\u001b[?1049hvim");
    const line: MirrorLine = await mirror.anchorAsync(null);
    mirror.resize(new TerminalSize(10, 10));
    await mirror.snapshotAsync();
    line.dispose();

    assert.deepEqual([line.number, line.index], [2, null]);
    mirror.dispose();
    await recorder.history.closeAsync();
  });

  it("numbers on past the lines a full reset or an erase of the saved lines removes, cutting them from a range", async () => {
    const recorder: MirrorRecorder = new MirrorRecorder();
    const reset: TerminalMirror = recorder.create(20, 5);
    await writeAsync(reset, "a\r\nb\r\nc\r\n");
    await writeAsync(reset, "\u001bcafter\r\n");
    const erasedRecorder: MirrorRecorder = new MirrorRecorder();
    const erased: TerminalMirror = erasedRecorder.create(20, 5);
    await writeAsync(erased, Array.from({ length: 10 }, (_t, index) => `l${index}`).join("\r\n"));
    const erasedCursor: number = await cursorAsync(erased);
    await writeAsync(erased, "\u001b[3J");

    const afterReset: TerminalRunOutput = await reset.readLinesAsync(at(0), null, 10);
    const afterErase: TerminalRunOutput = await erased.readLinesAsync(at(0), null, 20);

    assert.deepEqual([await cursorAsync(reset), afterReset.lines.map(t => t.text), afterReset.cutLines], [6, ["after", ""], 5]);
    assert.deepEqual([erasedCursor, await cursorAsync(erased)], [9, 9]);
    assert.deepEqual([afterErase.lines.map(t => t.text), afterErase.cutLines], [["l5", "l6", "l7", "l8", "l9"], 5]);
    reset.dispose();
    erased.dispose();
    await recorder.history.closeAsync();
    await erasedRecorder.history.closeAsync();
  });
});
