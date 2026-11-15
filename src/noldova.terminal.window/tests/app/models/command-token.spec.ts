/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import { CommandTokenKind } from "../../../src/app/enums/command-token-kind.ts";
import { CommandToken } from "../../../src/app/models/command-token.ts";

describe("CommandToken", () => {
  it("holds its start, end and kind", () => {
    const token: CommandToken = new CommandToken(3, 9, CommandTokenKind.Option);

    expect([token.start, token.end, token.kind]).toEqual([3, 9, "Option"]);
  });
});
