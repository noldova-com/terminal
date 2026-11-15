/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { TerminalRestoreParams } from "../../src/models/terminal-restore-params.ts";
import { TerminalSize } from "../../src/models/terminal-size.ts";

describe("TerminalRestoreParams", () => {
  it("writes and reads its wire form", () => {
    const json: object = { size: { cols: 100, rows: 40 }, shellId: "zsh", storedLimit: 20_971_520 };
    const params: TerminalRestoreParams = TerminalRestoreParams.fromJson(json);

    assert.deepEqual([params.size.columns, params.shellId, params.storedLimit], [100, "zsh", 20_971_520]);
    assert.deepEqual(new TerminalRestoreParams(new TerminalSize(100, 40), "zsh", 20_971_520).toJson(), json);
  });

  it("leaves a gone shell to the runtime's default and stores 100 MiB unless told otherwise", () => {
    assert.deepEqual(new TerminalRestoreParams(new TerminalSize(80, 24)).toJson(), { size: { cols: 80, rows: 24 }, shellId: null, storedLimit: 104_857_600 });
    assert.equal(TerminalRestoreParams.fromJson({ size: { cols: 80, rows: 24 }, shellId: null, storedLimit: 104_857_600 }).shellId, null);
  });

  it("refuses a blank shell, a limit out of bounds and a missing size", () => {
    assert.throws(() => new TerminalRestoreParams(new TerminalSize(80, 24), " "), { name: "ArgumentException", parameterName: "shellId" });
    for (const limit of [10_485_759, 10_485_760_001, 10_485_760.5])
      assert.throws(() => new TerminalRestoreParams(new TerminalSize(80, 24), null, limit), { name: "ArgumentOutOfRangeException", parameterName: "storedLimit" });
    assert.throws(() => TerminalRestoreParams.fromJson({ size: { cols: 80, rows: 24 }, shellId: null, storedLimit: 1 }), { name: "JsonException", path: "$.storedLimit" });
    assert.throws(() => TerminalRestoreParams.fromJson({ size: null, shellId: null, storedLimit: 104_857_600 }), { name: "JsonException", path: "$.size" });
    assert.throws(() => TerminalRestoreParams.fromJson({ cols: 80, rows: 24 }), { name: "JsonException" });
  });
});
