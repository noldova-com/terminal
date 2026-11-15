/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { TerminalCompletionKind } from "@noldova/terminal.protocol";
import { describe, it } from "vitest";

import { CompletionCandidate } from "../../src/models/completion-candidate.ts";

describe("CompletionCandidate", () => {
  it("holds its value, label, kind and whether it closes a quote", () => {
    const candidate: CompletionCandidate = new CompletionCandidate("\"My Files/\"", "My Files/", TerminalCompletionKind.Folder, true);

    assert.equal(candidate.value, "\"My Files/\"");
    assert.equal(candidate.label, "My Files/");
    assert.equal(candidate.kind, TerminalCompletionKind.Folder);
    assert.equal(candidate.closesQuote, true);
  });
});
