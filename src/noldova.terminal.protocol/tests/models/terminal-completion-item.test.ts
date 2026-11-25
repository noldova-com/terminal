/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { ProtocolReader, TerminalCompletionItem, TerminalCompletionKind } from "@noldova/terminal.protocol";

import { Expect } from "../support/expect.ts";

@TestClass
export class TerminalCompletionItemTests {
  @TestMethod
  public writesAndReadsItsWireFormForEachKind(): void {
    for (const kind of Object.values(TerminalCompletionKind)) {
      const json: object = { text: "My\\ Notes", label: "My Notes", kind };
      const item: TerminalCompletionItem = TerminalCompletionItem.fromReader(ProtocolReader.fromValue(json));

      Expect.same(["My\\ Notes", "My Notes", kind], [item.text, item.label, item.kind]);
      Expect.same(json, item.toJson());
    }
  }

  @TestMethod
  public holdsATextAndALabelUpTo4096Characters(): void {
    const item: TerminalCompletionItem = new TerminalCompletionItem("t".repeat(4_096), "l".repeat(4_096), TerminalCompletionKind.Folder);

    Expect.same([4_096, 4_096, "Folder"], [item.text.length, item.label.length, item.kind]);
  }

  @TestMethod
  public refusesABlankOrTooLongTextOrLabel(): void {
    Expect.throwsMatching(() => new TerminalCompletionItem(" ", "ls", TerminalCompletionKind.File), { name: "ArgumentException", parameterName: "text", message: "The value must not be blank. (Parameter 'text')" });
    Expect.throwsMatching(() => new TerminalCompletionItem("ls", "", TerminalCompletionKind.File), { name: "ArgumentException", parameterName: "label", message: "The value must not be blank. (Parameter 'label')" });
    Expect.throwsMatching(() => new TerminalCompletionItem("t".repeat(4_097), "ls", TerminalCompletionKind.File), { name: "ArgumentException", parameterName: "text", message: "The value must have at most 4096 characters. (Parameter 'text')" });
    Expect.throwsMatching(() => new TerminalCompletionItem("ls", "l".repeat(4_097), TerminalCompletionKind.File), { name: "ArgumentException", parameterName: "label", message: "The value must have at most 4096 characters. (Parameter 'label')" });
  }

  @TestMethod
  public refusesATextWithAC0DELOrC1ControlCharacterWhichTheTerminalWouldTypeAsAKeyButTakesOneInALabel(): void {
    for (const text of ["run\u0001x", "a\u001b", "a\u0000", "a\u007f", "a\u0085", "a\u009f", "a\n"])
      Expect.throwsMatching(() => new TerminalCompletionItem(text, "run", TerminalCompletionKind.Script), {
        name: "ArgumentException", parameterName: "text",
        message: "The value must not hold a control character, such as a line break, since the terminal types it as one line and enters it. (Parameter 'text')"
      });
    Assert.areEqual("run\u0015", new TerminalCompletionItem("run", "run\u0015", TerminalCompletionKind.Script).label);
  }

  @TestMethod
  public namesTheFieldItCannotReadAndAnUnknownOne(): void {
    const read = (value: object): TerminalCompletionItem => TerminalCompletionItem.fromReader(ProtocolReader.fromValue(value));

    Expect.throwsMatching(() => read({ text: " ", label: "ls", kind: "File" }), { name: "JsonException", path: "$.text" });
    Expect.throwsMatching(() => read({ text: "ls", label: "l".repeat(4_097), kind: "File" }), { name: "JsonException", path: "$.label" });
    Expect.throwsMatching(() => read({ text: "ls", label: "ls" }), { name: "JsonException", path: "$.kind" });
    Expect.throwsMatching(() => read({ text: "ls", label: "ls", kind: "file" }), { name: "JsonException", path: "$.kind" });
    Expect.throwsMatching(() => read({ text: "ls", label: "ls", kind: "File", detail: "" }), { name: "JsonException", path: "$.detail" });
  }
}
