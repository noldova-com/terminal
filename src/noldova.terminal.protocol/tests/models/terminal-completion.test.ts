/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { TerminalCompletion, TerminalCompletionItem, TerminalCompletionKind } from "@noldova/terminal.protocol";

import { Expect } from "../support/expect.ts";

@TestClass
export class TerminalCompletionTests {
  @TestMethod
  public writesAndReadsItsWireFormWithEachKindOfChoice(): void {
    const json: object = {
      replaceFrom: 3,
      items: Object.values(TerminalCompletionKind).map(t => ({ text: `My\\ ${t}`, label: `My ${t}`, kind: t })),
      isShellTab: false
    };
    const completion: TerminalCompletion = TerminalCompletion.fromJson(json);

    Assert.areEqual(3, completion.replaceFrom);
    Expect.same([
      ["My\\ File", "My File", "File"],
      ["My\\ Folder", "My Folder", "Folder"],
      ["My\\ Command", "My Command", "Command"],
      ["My\\ Branch", "My Branch", "Branch"],
      ["My\\ Script", "My Script", "Script"],
      ["My\\ Option", "My Option", "Option"]
    ], completion.items.map(t => [t.text, t.label, t.kind]));
    Expect.same(json, completion.toJson());
  }

  @TestMethod
  public saysWhenTheShellGotAPlainTabInPlaceOfAListAndThatItDidntWhenLeftOut(): void {
    Assert.areEqual(true, TerminalCompletion.fromJson({ replaceFrom: 0, items: [], isShellTab: true }).isShellTab);
    Assert.areEqual(false, TerminalCompletion.fromJson({ replaceFrom: 0, items: [] }).isShellTab);
    Expect.same({ replaceFrom: 2, items: [], isShellTab: true }, new TerminalCompletion(2, [], true).toJson());
  }

  @TestMethod
  public holdsNoChoicesAndUpTo500OfThem(): void {
    const item: TerminalCompletionItem = new TerminalCompletionItem("ls", "ls", TerminalCompletionKind.Command);

    Assert.areEqual(0, new TerminalCompletion(0, []).items.length);
    Assert.areEqual(500, new TerminalCompletion(4_096, Array.from({ length: 500 }, () => item)).items.length);
  }

  @TestMethod
  public refusesAStartOutsideALineMoreThan500ChoicesAndABlankOrTooLongTextOrLabel(): void {
    const item: TerminalCompletionItem = new TerminalCompletionItem("ls", "ls", TerminalCompletionKind.Command);

    for (const replaceFrom of [-1, 4_097, 0.5])
      Expect.throwsMatching(() => new TerminalCompletion(replaceFrom, []), { name: "ArgumentOutOfRangeException", parameterName: "replaceFrom" });
    Expect.throwsMatching(() => new TerminalCompletion(0, Array.from({ length: 501 }, () => item)), { name: "ArgumentException", parameterName: "items", message: "The value must hold at most 500 choices. (Parameter 'items')" });
    Expect.throwsMatching(() => new TerminalCompletionItem(" ", "ls", TerminalCompletionKind.File), { name: "ArgumentException", parameterName: "text" });
    Expect.throwsMatching(() => new TerminalCompletionItem("ls", "", TerminalCompletionKind.File), { name: "ArgumentException", parameterName: "label" });
    Expect.throwsMatching(() => new TerminalCompletionItem("x".repeat(4_097), "x", TerminalCompletionKind.File), { name: "ArgumentException", parameterName: "text" });
  }

  @TestMethod
  public namesTheFieldItCannotRead(): void {
    Expect.throwsMatching(() => TerminalCompletion.fromJson({ replaceFrom: 0, items: [{ text: "ls", label: "ls", kind: "Flag" }] }), { name: "JsonException", path: "$.items.0.kind" });
    Expect.throwsMatching(() => TerminalCompletion.fromJson({ replaceFrom: 0, items: [], isShellTab: 1 }), { name: "JsonException", path: "$.isShellTab" });
    Expect.throwsMatching(() => TerminalCompletion.fromJson({ replaceFrom: 0, items: [{ text: "ls", label: "ls", kind: "File", detail: "" }] }), { name: "JsonException" });
    Expect.throwsMatching(() => TerminalCompletion.fromJson({ replaceFrom: 0, items: {} }), { name: "JsonException", path: "$.items" });
    Expect.throwsMatching(() => TerminalCompletion.fromJson({ items: [] }), { name: "JsonException", path: "$.replaceFrom" });
    Expect.throwsMatching(() => TerminalCompletion.fromJson({ replaceFrom: 0, items: Array.from({ length: 501 }, () => ({ text: "ls", label: "ls", kind: "Command" })) }), { name: "JsonException", path: "$.items", message: "$.items: Expected at most 500 items." });
  }

  @TestMethod
  public keepsItsOwnCopyOfTheChoices(): void {
    const items: TerminalCompletionItem[] = [new TerminalCompletionItem("ls", "ls", TerminalCompletionKind.File)];
    const completion: TerminalCompletion = new TerminalCompletion(0, items);
    items.push(new TerminalCompletionItem("cd", "cd", TerminalCompletionKind.File));

    Assert.areEqual(1, completion.items.length);
  }
}
