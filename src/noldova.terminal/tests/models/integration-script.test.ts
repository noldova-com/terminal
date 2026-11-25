/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { IntegrationScript } from "../../src/models/integration-script.ts";

describe("IntegrationScript", () => {
  it("holds its file name and text", () => {
    const script: IntegrationScript = new IntegrationScript("noldova.bash", "echo ready");

    assert.equal(script.fileName, "noldova.bash");
    assert.equal(script.text, "echo ready");
  });
});
