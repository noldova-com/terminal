/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import { CommandTokenKind } from "../../../src/app/enums/command-token-kind.ts";
import { CommandColors } from "../../../src/app/models/command-colors.ts";

describe("CommandColors", () => {
  it("gives each kind the color it was given, none for a kind without one, and keeps its colors when the given ones change", () => {
    const given: Partial<Record<CommandTokenKind, string>> = { Command: "#795E26", Option: "#0000ff" };

    const colors: CommandColors = new CommandColors(given);
    given.Command = "#ff0000";

    expect([colors.colorOf(CommandTokenKind.Command), colors.colorOf(CommandTokenKind.Option), colors.colorOf(CommandTokenKind.Path)])
      .toEqual(["#795E26", "#0000ff", undefined]);
    expect(new CommandColors().colorOf(CommandTokenKind.Command)).toBeUndefined();
  });
});
