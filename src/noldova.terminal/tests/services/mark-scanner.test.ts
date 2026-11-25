/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import type { MarkKind } from "../../src/enums/mark-kind.ts";
import type { ShellMark } from "../../src/models/shell-mark.ts";
import { Resources } from "../../src/resources.ts";
import { MarkScanner } from "../../src/services/mark-scanner.ts";

const NONCE: string = "f00d";
const BELL: string = "\u0007";
const ST: string = "\u001b\\";

function mark(payload: string, terminator: string = BELL): string {
  return `\u001b]6973;${payload}${terminator}`;
}

function eightBitMark(payload: string, terminator: string = BELL): string {
  return `\u009d6973;${payload}${terminator}`;
}

function letterOf(kind: MarkKind): string {
  const letter: string | undefined = [...Resources.markKindLetters].find(([, t]) => t === kind)?.[0];
  assert.ok(!Object.isUndefined(letter), `No mark letter names ${kind}.`);
  return letter;
}

function describeMarks(marks: readonly ShellMark[]): readonly string[] {
  return marks.map(t => `${letterOf(t.kind)}:${t.value ?? "-"}@${t.offset}`);
}

describe("MarkScanner", () => {
  it("finds the marks that carry the terminal's secret, each at the offset after it", () => {
    const first: string = `ab${mark(`A;${NONCE}`)}`;
    const second: string = `cd${mark(`D;${NONCE};127`, ST)}`;

    assert.deepEqual(describeMarks(new MarkScanner(NONCE).scan(first + second, 100)), [
      `A:-@${100 + first.length}`,
      `D:127@${100 + first.length + second.length}`
    ]);
  });

  it("takes whichever terminator comes first", () => {
    const scanner: MarkScanner = new MarkScanner(NONCE);
    const bellFirst: string = mark(`A;${NONCE}`);
    const stringTerminatorFirst: string = `${mark(`B;${NONCE}`, ST)}${BELL}`;

    assert.deepEqual(describeMarks(scanner.scan(`${bellFirst}${ST}${stringTerminatorFirst}`, 0)), [
      `A:-@${bellFirst.length}`,
      `B:-@${bellFirst.length + ST.length + stringTerminatorFirst.length - BELL.length}`
    ]);
  });

  for (const payload of [`A;beef`, `A`, `X;${NONCE}`, ""])
    it(`ignores the mark ${JSON.stringify(payload)}, which a program could print`, () => {
      assert.deepEqual(new MarkScanner(NONCE).scan(`${mark(payload)}${mark(`B;${NONCE}`)}`, 0).map(t => t.kind), ["PromptEnd"]);
    });

  it("decodes a property's escaped characters", () => {
    const marks: readonly ShellMark[] = new MarkScanner(NONCE).scan(mark(`P;${NONCE};Cwd=/a\\x3bb\\x5Cc\\x0a`), 0);

    assert.equal(marks[0]?.value, "Cwd=/a;b\\c\n");
  });

  it("gives an options mark's fields apart, each decoded, so an escaped separator stays inside its option, and none for an empty answer", () => {
    const marks: readonly ShellMark[] = new MarkScanner(NONCE).scan(mark(`O;${NONCE};--all;--a\\x3bb;-x`) + mark(`O;${NONCE}`), 0);

    assert.deepEqual(marks.map(t => [t.kind, t.values]), [["Options", ["--all", "--a;b", "-x"]], ["Options", []]]);
  });

  it("ignores the C0 controls and DEL inside a mark, as a terminal does, and keeps the mark's offset after its terminator", () => {
    const broken: string = mark(`B;f0\r\n\r0d`);
    const property: string = mark(`P;${NONCE}\u0000;Cwd=/a\u007f\u0008b`);

    assert.deepEqual(describeMarks(new MarkScanner(NONCE).scan(broken + property, 10)), [`B:-@${10 + broken.length}`, `P:Cwd=/ab@${10 + broken.length + property.length}`]);
  });

  for (const split of [1, 3, 7, 10, 14, 17])
    it(`finds a mark split after ${split} characters across two chunks`, () => {
      const scanner: MarkScanner = new MarkScanner(NONCE);
      const text: string = `x${mark(`D;${NONCE};0`, ST)}y`;

      const marks: readonly ShellMark[] = [...scanner.scan(text.slice(0, split), 50), ...scanner.scan(text.slice(split), 50 + split)];

      assert.deepEqual(describeMarks(marks), [`D:0@${50 + text.length - 1}`]);
    });

  it("drops an unfinished mark longer than 20 KiB and finds the next one", () => {
    const scanner: MarkScanner = new MarkScanner(NONCE);
    const long: string = `\u001b]6973;P;${NONCE};${"x".repeat(20_480)}`;

    assert.deepEqual(scanner.scan(long, 0), []);
    assert.deepEqual(describeMarks(scanner.scan(`${BELL}${mark(`A;${NONCE}`)}`, long.length)), [`A:-@${long.length + 1 + mark(`A;${NONCE}`).length}`]);
  });

  for (const [description, length, split] of [
    ["whole, at 20 KiB", 20_480, null],
    ["whole, past 20 KiB", 20_481, null],
    ["split, at 20 KiB", 20_480, 15_000],
    ["split, past 20 KiB, with each read's part under it", 20_481, 15_000]
  ] as const)
    it(`${length > 20_480 ? "drops" : "keeps"} a mark ${description}, and finds the next one`, () => {
      const scanner: MarkScanner = new MarkScanner(NONCE);
      const head: string = `P;${NONCE};Path=`;
      const long: string = mark(`${head}${"x".repeat(length - mark(head).length)}`);
      const next: string = mark(`A;${NONCE}`);
      const text: string = `${long}${next}`;
      const parts: readonly string[] = Object.isNull(split) ? [text] : [text.slice(0, split), text.slice(split)];

      const marks: readonly ShellMark[] = parts.flatMap((part, index) => scanner.scan(part, index === 0 ? 0 : split ?? 0));

      assert.equal(long.length, length);
      assert.deepEqual(marks.map(t => `${letterOf(t.kind)}:${t.value?.length ?? "-"}@${t.offset}`),
        [...length > 20_480 ? [] : [`P:${length - mark(`P;${NONCE};`).length}@${long.length}`], `A:-@${text.length}`]);
    });

  it("keeps the escape that ends a dropped unfinished mark, and finds the shell's mark that it starts in the next chunk", () => {
    const scanner: MarkScanner = new MarkScanner(NONCE);
    const long: string = `\u001b]6973;from a program ${"x".repeat(20_480)}\u001b`;
    const rest: string = `]6973;A;${NONCE}${BELL}`;

    assert.deepEqual(scanner.scan(long, 0), []);
    assert.deepEqual(describeMarks(scanner.scan(rest, long.length)), [`A:-@${long.length + rest.length}`]);
  });

  it("ends a program's unterminated introducer at the shell's next mark, and finds that mark", () => {
    const program: string = "\u001b]6973;from a program ";

    assert.deepEqual(describeMarks(new MarkScanner(NONCE).scan(`${program}${mark(`A;${NONCE}`)}`, 10)), [`A:-@${10 + program.length + mark(`A;${NONCE}`).length}`]);
  });

  for (const split of [1, 7, 15, 16, 22, 29])
    it(`ends a program's unterminated introducer at the shell's next mark across two chunks, split after ${split} characters`, () => {
      const scanner: MarkScanner = new MarkScanner(NONCE);
      const text: string = `\u001b]6973;P;${NONCE};x${mark(`B;${NONCE}`, ST)}`;

      const marks: readonly ShellMark[] = [...scanner.scan(text.slice(0, split), 0), ...scanner.scan(text.slice(split), split)];

      assert.deepEqual(describeMarks(marks), [`B:-@${text.length}`]);
    });

  it("ends a mark at any escape other than ST's, and finds the next one", () => {
    const scanner: MarkScanner = new MarkScanner(NONCE);
    const text: string = `${mark(`A;${NONCE}`, "\u001b[0m")}${mark(`B;${NONCE}`)}`;

    assert.deepEqual(describeMarks(scanner.scan(text, 0)), [`B:-@${text.length}`]);
  });

  it("ends a mark at the 8-bit ST, U+009C", () => {
    const text: string = mark(`A;${NONCE}`, "\u009c");

    assert.deepEqual(describeMarks(new MarkScanner(NONCE).scan(text, 0)), [`A:-@${text.length}`]);
  });

  it("ends a property at a U+009C inside it, where the escape tracker ends the sequence", () => {
    const text: string = mark(`P;${NONCE};Cwd=/a\u009cb`);

    assert.deepEqual(describeMarks(new MarkScanner(NONCE).scan(text, 0)), [`P:Cwd=/a@${text.indexOf("\u009c") + 1}`]);
  });

  for (const control of ["\u0018", "\u001a"])
    it(`drops a mark that ${JSON.stringify(control)} cancels, as the escape tracker does, and finds the next one`, () => {
      const text: string = `${mark(`P;${NONCE};Cwd=/a${control}b`)}${mark(`A;${NONCE}`)}`;

      assert.deepEqual(describeMarks(new MarkScanner(NONCE).scan(text, 0)), [`A:-@${text.length}`]);
    });

  for (const terminator of [BELL, ST, "\u009c"])
    it(`finds a mark that the 8-bit introducer, U+009D, starts and ${JSON.stringify(terminator)} ends, as the escape tracker reads one`, () => {
      const text: string = `ab${eightBitMark(`A;${NONCE}`, terminator)}`;

      assert.deepEqual(describeMarks(new MarkScanner(NONCE).scan(text, 0)), [`A:-@${text.length}`]);
    });

  it("ignores an 8-bit mark without the terminal's secret", () => {
    assert.deepEqual(new MarkScanner(NONCE).scan(`${eightBitMark("A;beef")}${eightBitMark(`B;${NONCE}`)}`, 0).map(t => t.kind), ["PromptEnd"]);
  });

  for (const split of [1, 2, 4, 7, 10])
    it(`finds an 8-bit mark split after ${split} characters across two chunks`, () => {
      const scanner: MarkScanner = new MarkScanner(NONCE);
      const text: string = `x${eightBitMark(`D;${NONCE};0`, ST)}y`;

      const marks: readonly ShellMark[] = [...scanner.scan(text.slice(0, split), 50), ...scanner.scan(text.slice(split), 50 + split)];

      assert.deepEqual(describeMarks(marks), [`D:0@${50 + text.length - 1}`]);
    });

  it("ends a program's unterminated 8-bit introducer at the shell's next mark, and finds that mark", () => {
    const text: string = `\u009d6973;from a program ${mark(`A;${NONCE}`)}`;

    assert.deepEqual(describeMarks(new MarkScanner(NONCE).scan(text, 0)), [`A:-@${text.length}`]);
  });

  it("reads an 8-bit introducer inside a program's unterminated mark as part of it, as the escape tracker does", () => {
    const text: string = `\u001b]6973;from a program ${eightBitMark(`A;${NONCE}`)}${mark(`B;${NONCE}`)}`;

    assert.deepEqual(describeMarks(new MarkScanner(NONCE).scan(text, 0)), [`B:-@${text.length}`]);
  });

  it("reads U+075D, whose UTF-8 ends in the byte 9D, as text", () => {
    const text: string = `\u075d6973;A;${NONCE}${BELL}${mark(`B;${NONCE}`)}`;

    assert.deepEqual(describeMarks(new MarkScanner(NONCE).scan(text, 0)), [`B:-@${text.length}`]);
  });

  it("keeps nothing back from output without marks", () => {
    const scanner: MarkScanner = new MarkScanner(NONCE);

    assert.deepEqual(scanner.scan("plain \u001b[1mtext\u001b[0m", 0), []);
    assert.deepEqual(describeMarks(scanner.scan(mark(`A;${NONCE}`), 21)), [`A:-@${21 + mark(`A;${NONCE}`).length}`]);
  });
});
