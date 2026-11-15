/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { ArgumentException } from "@noldova/context.exceptions";
import { describe, it } from "vitest";

import { TerminalOpenInput } from "../../../src/tools/models/terminal-open-input.ts";

describe("TerminalOpenInput", () => {
  it("reads the shell and the explanation", () => {
    const input: TerminalOpenInput = TerminalOpenInput.fromJson({ shell: "pwsh", explanation: "Needs PowerShell." });

    assert.equal(input.shellId, "pwsh");
    assert.equal(input.explanation, "Needs PowerShell.");
  });

  it("takes the default shell and no explanation when absent", () => {
    const input: TerminalOpenInput = TerminalOpenInput.fromJson({});

    assert.equal(input.shellId, null);
    assert.equal(input.explanation, null);
  });

  it("refuses unknown fields, a blank shell and a long explanation", () => {
    assert.throws(() => TerminalOpenInput.fromJson({ cwd: "/" }), { name: "JsonException", path: "$.cwd" });
    assert.throws(() => TerminalOpenInput.fromJson({ shell: " " }), ArgumentException);
    assert.throws(() => new TerminalOpenInput(null, "x".repeat(2_001)), ArgumentException);
  });
});
