/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/context.exceptions";
import { JsonException } from "@noldova/context.json";
import { describe, expect, it } from "vitest";

import { TerminalNewArguments } from "../../../src/app/models/terminal-new-arguments.ts";

describe("TerminalNewArguments", () => {
  const fields = (value: TerminalNewArguments): readonly unknown[] => [value.folder, value.shellId, value.tabGroup, value.owner, value.takesNewOwner];

  it("holds each argument it is given, and no group, owner or new owner by default", () => {
    expect(fields(new TerminalNewArguments("/work", "bash", "g1", "example.chat/42"))).toEqual(["/work", "bash", "g1", "example.chat/42", false]);
    expect(fields(new TerminalNewArguments("C:\\work", null, null, null, true))).toEqual(["C:\\work", null, null, null, true]);
    expect(fields(new TerminalNewArguments(null, null))).toEqual([null, null, null, null, false]);
  });

  it("gives a terminal with no folder, shell, group or owner that takes a new owner, for the toggle", () => {
    expect(fields(TerminalNewArguments.forNewOwner())).toEqual([null, null, null, null, true]);
  });

  it("reads the command's arguments, and none from null or an empty object", () => {
    expect(fields(TerminalNewArguments.fromJson({ folder: "/work", shellId: "zsh", tabGroup: "g2", owner: "example.chat/1" })))
      .toEqual(["/work", "zsh", "g2", "example.chat/1", false]);
    expect(fields(TerminalNewArguments.fromJson({ folder: null, takesNewOwner: true }))).toEqual([null, null, null, null, true]);
    expect(fields(TerminalNewArguments.fromJson(null))).toEqual([null, null, null, null, false]);
    expect(fields(TerminalNewArguments.fromJson({}))).toEqual([null, null, null, null, false]);
  });

  it("refuses a folder that isn't absolute, a blank shell, group or owner, and an owner with a new owner", () => {
    const refusals: readonly (() => TerminalNewArguments)[] = [
      () => new TerminalNewArguments("work", null),
      () => new TerminalNewArguments(" ", null),
      () => new TerminalNewArguments(null, " "),
      () => new TerminalNewArguments(null, null, ""),
      () => new TerminalNewArguments(null, null, null, " "),
      () => new TerminalNewArguments(null, null, null, "o".repeat(257)),
      () => new TerminalNewArguments(null, null, null, "example.chat/1", true)
    ];

    expect(refusals.map(t => {
      try {
        t();
        return null;
      } catch (error) {
        return error instanceof ArgumentException ? [error.parameterName, error.message] : error;
      }
    })).toEqual([
      ["folder", "The value must be an absolute path. (Parameter 'folder')"],
      ["folder", "The value must not be blank. (Parameter 'folder')"],
      ["shellId", "The value must not be blank. (Parameter 'shellId')"],
      ["tabGroup", "The value must not be blank. (Parameter 'tabGroup')"],
      ["owner", "The value must not be blank. (Parameter 'owner')"],
      ["owner", "The value must have at most 256 characters. (Parameter 'owner')"],
      ["takesNewOwner", "The value can't come with an owner. (Parameter 'takesNewOwner')"]
    ]);
  });

  it("names the field it cannot read, and an unknown one", () => {
    const paths: readonly unknown[] = [{ cwd: "/work" }, { folder: 3 }, { shellId: "s".repeat(201) }, { takesNewOwner: "yes" }, "/work"].map(t => {
      try {
        TerminalNewArguments.fromJson(t);
        return null;
      } catch (error) {
        return error instanceof JsonException ? error.path : error;
      }
    });

    expect(paths).toEqual(["$.cwd", "$.folder", "$.shellId", "$.takesNewOwner", "$"]);
  });
});
