/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import { AnsiColorToken } from "../../../src/app/models/ansi-color-token.ts";

describe("AnsiColorToken", () => {
  it("holds an ANSI color's theme key and its token name", () => {
    const token: AnsiColorToken = new AnsiColorToken("brightBlack", "bright-black");

    expect(token.key).toBe("brightBlack");
    expect(token.name).toBe("bright-black");
  });
});
