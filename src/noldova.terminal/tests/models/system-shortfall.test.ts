/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { SystemRequirement } from "../../src/enums/system-requirement.ts";
import { SystemShortfall } from "../../src/models/system-shortfall.ts";

describe("SystemShortfall", () => {
  it("holds the requirement the system falls short of and what it found", () => {
    const shortfall: SystemShortfall = new SystemShortfall(SystemRequirement.Glibc, "2.27");

    assert.equal(shortfall.requirement, SystemRequirement.Glibc);
    assert.equal(shortfall.found, "2.27");
  });
});
