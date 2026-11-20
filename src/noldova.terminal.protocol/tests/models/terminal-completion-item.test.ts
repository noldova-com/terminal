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
import { ProtocolReader } from "../../src/services/protocol.reader.ts";

describe("TerminalCompletionItem", () => {
  it("writes and reads its wire form, for each kind", () => {
    for (const kind of Object.values(TerminalCompletionKind)) {
      const json: object = { text: "My\\ Notes", label: "My Notes", kind };
      const item: TerminalCompletionItem = TerminalCompletionItem.fromReader(ProtocolReader.fromValue(json));

      assert.deepEqual([item.text, item.label, item.kind], ["My\\ Notes", "My Notes", kind]);
      assert.deepEqual(item.toJson(), json);
    }
  });

  it("holds a text and a label up to 4096 characters", () => {
    const item: TerminalCompletionItem = new TerminalCompletionItem("t".repeat(4_096), "l".repeat(4_096), TerminalCompletionKind.Folder);

    assert.deepEqual([item.text.length, item.label.length, item.kind], [4_096, 4_096, "Folder"]);
  });

  it("refuses a blank or too long text or label", () => {
    assert.throws(() => new TerminalCompletionItem(" ", "ls", TerminalCompletionKind.File),
      { name: "ArgumentException", parameterName: "text", message: "The value must not be blank. (Parameter 'text')" });
    assert.throws(() => new TerminalCompletionItem("ls", "", TerminalCompletionKind.File),
      { name: "ArgumentException", parameterName: "label", message: "The value must not be blank. (Parameter 'label')" });
    assert.throws(() => new TerminalCompletionItem("t".repeat(4_097), "ls", TerminalCompletionKind.File),
      { name: "ArgumentException", parameterName: "text", message: "The value must have at most 4096 characters. (Parameter 'text')" });
    assert.throws(() => new TerminalCompletionItem("ls", "l".repeat(4_097), TerminalCompletionKind.File),
      { name: "ArgumentException", parameterName: "label", message: "The value must have at most 4096 characters. (Parameter 'label')" });
  });

  it("refuses a text with a C0, DEL or C1 control character, which the terminal would type as a key, but takes one in a label", () => {
    for (const text of ["run\u0001x", "a\u001b", "a\u0000", "a\u007f", "a\u0085", "a\u009f", "a\n"])
      assert.throws(() => new TerminalCompletionItem(text, "run", TerminalCompletionKind.Script), {
        name: "ArgumentException", parameterName: "text",
        message: "The value must not hold a control character, such as a line break, since the terminal types it as one line and enters it. (Parameter 'text')"
      });
    assert.equal(new TerminalCompletionItem("run", "run\u0015", TerminalCompletionKind.Script).label, "run\u0015");
  });

  it("names the field it cannot read, and an unknown one", () => {
    const read = (value: object): TerminalCompletionItem => TerminalCompletionItem.fromReader(ProtocolReader.fromValue(value));

    assert.throws(() => read({ text: " ", label: "ls", kind: "File" }), { name: "JsonException", path: "$.text" });
    assert.throws(() => read({ text: "ls", label: "l".repeat(4_097), kind: "File" }), { name: "JsonException", path: "$.label" });
    assert.throws(() => read({ text: "ls", label: "ls" }), { name: "JsonException", path: "$.kind" });
    assert.throws(() => read({ text: "ls", label: "ls", kind: "file" }), { name: "JsonException", path: "$.kind" });
    assert.throws(() => read({ text: "ls", label: "ls", kind: "File", detail: "" }), { name: "JsonException", path: "$.detail" });
  });
});
