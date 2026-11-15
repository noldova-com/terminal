/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import { CommandTokenKind } from "../../../src/app/enums/command-token-kind.ts";
import { CommandColorSpan } from "../../../src/app/models/command-color-span.ts";

describe("CommandColorSpan", () => {
  it("holds its row, place, width, kind and text, and reads as them joined by commas", () => {
    const span: CommandColorSpan = new CommandColorSpan(3, 2, 4, CommandTokenKind.Command, "echo");

    expect([span.row, span.x, span.width, span.kind, span.text, span.toString()]).toEqual([3, 2, 4, "Command", "echo", "3,2,4,Command,echo"]);
  });

  it("continues only at the cell right after it on its row, for its own kind", () => {
    const span: CommandColorSpan = new CommandColorSpan(3, 2, 4, CommandTokenKind.Command, "echo");

    expect([
      span.continuesAt(3, 6, CommandTokenKind.Command),
      span.continuesAt(3, 7, CommandTokenKind.Command),
      span.continuesAt(4, 6, CommandTokenKind.Command),
      span.continuesAt(3, 6, CommandTokenKind.Option),
      span.continuesAt(3, 6, undefined)
    ]).toEqual([true, false, false, false, false]);
  });

  it("grows by the cells and text it is extended with, and continues after them", () => {
    const span: CommandColorSpan = new CommandColorSpan(0, 0, 2, CommandTokenKind.Path, "./");

    span.extend(2, "日");

    expect([span.width, span.text, span.continuesAt(0, 4, CommandTokenKind.Path), span.toString()]).toEqual([4, "./日", true, "0,0,4,Path,./日"]);
  });
});
