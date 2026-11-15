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

import { WindowsPty } from "../../src/models/windows-pty.ts";

describe("WindowsPty", () => {
  it("writes and reads its wire form with the conpty backend", () => {
    assert.deepEqual(new WindowsPty(26100).toJson(), { backend: "conpty", buildNumber: 26100 });
    assert.equal(WindowsPty.fromJson({ backend: "conpty", buildNumber: 19045 }).buildNumber, 19045);
  });

  it("refuses a negative build number", () => {
    assert.throws(() => new WindowsPty(-1), ArgumentException);
  });

  it("refuses another backend", () => {
    assert.throws(() => WindowsPty.fromJson({ backend: "winpty", buildNumber: 17763 }), { name: "JsonException", path: "$.backend" });
  });

  it("takes build numbers up to the largest a 32-bit number holds, and refuses one above it", () => {
    assert.equal(new WindowsPty(4_294_967_295).buildNumber, 4_294_967_295);
    assert.throws(() => new WindowsPty(4_294_967_296), { name: "ArgumentOutOfRangeException", parameterName: "buildNumber" });
  });
});
