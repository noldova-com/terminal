/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { RegistryValue } from "../../src/models/registry-value.ts";

describe("RegistryValue", () => {
  it("keeps its text and whether it expands", () => {
    const value: RegistryValue = new RegistryValue("%SystemRoot%\\system32", true);

    assert.deepEqual([value.text, value.isExpandable], ["%SystemRoot%\\system32", true]);
  });
});
