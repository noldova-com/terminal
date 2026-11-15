/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { KeySequence } from "../../../src/tools/models/key-sequence.ts";

describe("KeySequence", () => {
  it("keeps control characters and shows them escaped", () => {
    const keys: KeySequence = new KeySequence("y\r\u0003\u001b[A\\");

    assert.equal(keys.text, "y\r\u0003\u001b[A\\");
    assert.equal(keys.display, "y\\r\\u{0003}\\u{001B}[A\\\\");
    assert.equal(keys.hasHiddenCharacters, false);
  });

  it("flags hidden characters", () => {
    assert.equal(new KeySequence("a\u200Bb").hasHiddenCharacters, true);
  });

  it("accepts a single space", () => {
    assert.equal(new KeySequence(" ").text, " ");
  });

  it("refuses empty keys", () => {
    assert.throws(() => new KeySequence(""), { name: "ArgumentException", message: "The value must not be empty. (Parameter 'keys')" });
  });

  it("accepts 4096 bytes of UTF-8 and refuses more", () => {
    assert.equal(new KeySequence("é".repeat(2_048)).text.length, 2_048);
    assert.throws(() => new KeySequence(`${"é".repeat(2_048)}x`), { name: "ArgumentException", message: "The value must have at most 4096 bytes in UTF-8. (Parameter 'keys')" });
  });
});
