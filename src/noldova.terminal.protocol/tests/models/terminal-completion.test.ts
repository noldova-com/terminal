/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { TerminalCompletionKind } from "../../src/enums/terminal-completion-kind.ts";
import { TerminalCompletionItem } from "../../src/models/terminal-completion-item.ts";
import { TerminalCompletion } from "../../src/models/terminal-completion.ts";

describe("TerminalCompletion", () => {
  it("writes and reads its wire form, with each kind of choice", () => {
    const json: object = {
      replaceFrom: 3,
      items: Object.values(TerminalCompletionKind).map(t => ({ text: `My\\ ${t}`, label: `My ${t}`, kind: t })),
      isShellTab: false
    };
    const completion: TerminalCompletion = TerminalCompletion.fromJson(json);

    assert.equal(completion.replaceFrom, 3);
    assert.deepEqual(completion.items.map(t => [t.text, t.label, t.kind]), [
      ["My\\ File", "My File", "File"],
      ["My\\ Folder", "My Folder", "Folder"],
      ["My\\ Command", "My Command", "Command"],
      ["My\\ Branch", "My Branch", "Branch"],
      ["My\\ Script", "My Script", "Script"],
      ["My\\ Option", "My Option", "Option"]
    ]);
    assert.deepEqual(completion.toJson(), json);
  });

  it("says when the shell got a plain Tab in place of a list, and that it didn't when left out", () => {
    assert.equal(TerminalCompletion.fromJson({ replaceFrom: 0, items: [], isShellTab: true }).isShellTab, true);
    assert.equal(TerminalCompletion.fromJson({ replaceFrom: 0, items: [] }).isShellTab, false);
    assert.deepEqual(new TerminalCompletion(2, [], true).toJson(), { replaceFrom: 2, items: [], isShellTab: true });
  });

  it("holds no choices, and up to 500 of them", () => {
    const item: TerminalCompletionItem = new TerminalCompletionItem("ls", "ls", TerminalCompletionKind.Command);

    assert.equal(new TerminalCompletion(0, []).items.length, 0);
    assert.equal(new TerminalCompletion(4_096, Array.from({ length: 500 }, () => item)).items.length, 500);
  });

  it("refuses a start outside a line, more than 500 choices, and a blank or too long text or label", () => {
    const item: TerminalCompletionItem = new TerminalCompletionItem("ls", "ls", TerminalCompletionKind.Command);

    for (const replaceFrom of [-1, 4_097, 0.5])
      assert.throws(() => new TerminalCompletion(replaceFrom, []), { name: "ArgumentOutOfRangeException", parameterName: "replaceFrom" });
    assert.throws(() => new TerminalCompletion(0, Array.from({ length: 501 }, () => item)),
      { name: "ArgumentException", parameterName: "items", message: "The value must hold at most 500 choices. (Parameter 'items')" });
    assert.throws(() => new TerminalCompletionItem(" ", "ls", TerminalCompletionKind.File), { name: "ArgumentException", parameterName: "text" });
    assert.throws(() => new TerminalCompletionItem("ls", "", TerminalCompletionKind.File), { name: "ArgumentException", parameterName: "label" });
    assert.throws(() => new TerminalCompletionItem("x".repeat(4_097), "x", TerminalCompletionKind.File), { name: "ArgumentException", parameterName: "text" });
  });

  it("names the field it cannot read", () => {
    assert.throws(() => TerminalCompletion.fromJson({ replaceFrom: 0, items: [{ text: "ls", label: "ls", kind: "Flag" }] }),
      { name: "JsonException", path: "$.items.0.kind" });
    assert.throws(() => TerminalCompletion.fromJson({ replaceFrom: 0, items: [], isShellTab: 1 }), { name: "JsonException", path: "$.isShellTab" });
    assert.throws(() => TerminalCompletion.fromJson({ replaceFrom: 0, items: [{ text: "ls", label: "ls", kind: "File", detail: "" }] }),
      { name: "JsonException" });
    assert.throws(() => TerminalCompletion.fromJson({ replaceFrom: 0, items: {} }), { name: "JsonException", path: "$.items" });
    assert.throws(() => TerminalCompletion.fromJson({ items: [] }), { name: "JsonException", path: "$.replaceFrom" });
    assert.throws(() => TerminalCompletion.fromJson({ replaceFrom: 0, items: Array.from({ length: 501 }, () => ({ text: "ls", label: "ls", kind: "Command" })) }),
      { name: "JsonException", path: "$.items", message: "$.items: Expected at most 500 items." });
  });

  it("keeps its own copy of the choices", () => {
    const items: TerminalCompletionItem[] = [new TerminalCompletionItem("ls", "ls", TerminalCompletionKind.File)];
    const completion: TerminalCompletion = new TerminalCompletion(0, items);
    items.push(new TerminalCompletionItem("cd", "cd", TerminalCompletionKind.File));

    assert.equal(completion.items.length, 1);
  });
});
