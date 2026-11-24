/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TestClass, TestMethod } from "@noldova/context.testing";

import { TerminalMissingCommands } from "../../src/models/terminal-missing-commands.ts";
import { Expect } from "../support/expect.ts";

@TestClass
export class TerminalMissingCommandsTests {
  @TestMethod
  public writesAndReadsItsWireForm(): void {
    const json: object = { names: ["gti"] };

    Expect.same(["gti"], TerminalMissingCommands.fromJson(json).names);
    Expect.same(json, TerminalMissingCommands.fromJson(json).toJson());
    Expect.same({ names: [] }, new TerminalMissingCommands([]).toJson());
  }

  @TestMethod
  public refusesABlankNameAndA65thName(): void {
    Expect.throwsMatching(() => new TerminalMissingCommands([" "]), { name: "ArgumentException", parameterName: "names" });
    Expect.throwsMatching(() => new TerminalMissingCommands(Array.from({ length: 65 }, () => "ls")), { name: "ArgumentException", parameterName: "names" });
  }

  @TestMethod
  public namesTheFieldItCannotRead(): void {
    Expect.throwsMatching(() => TerminalMissingCommands.fromJson({ names: [""] }), { name: "JsonException", path: "$.names.0" });
    Expect.throwsMatching(() => TerminalMissingCommands.fromJson({}), { name: "JsonException", path: "$.names" });
    Expect.throwsMatching(() => TerminalMissingCommands.fromJson({ names: [], extra: 1 }), { name: "JsonException" });
  }

  @TestMethod
  public keepsItsOwnCopyOfTheNames(): void {
    const names: string[] = ["git"];
    const missing: TerminalMissingCommands = new TerminalMissingCommands(names);
    names.push("npm");

    Expect.same(["git"], missing.names);
  }
}
