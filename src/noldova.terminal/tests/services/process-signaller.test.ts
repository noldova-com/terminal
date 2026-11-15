/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it, vi } from "vitest";

import { ProcessSignaller } from "../../src/services/process-signaller.ts";

describe("ProcessSignaller", () => {
  it("tells a running process from one that no longer runs", () => {
    assert.deepEqual([new ProcessSignaller().isRunning(process.pid), new ProcessSignaller().isRunning(2_000_000_000)], [true, false]);
  });

  it("counts a process it may not signal as running, and one that isn't found as not running", () => {
    const kill = vi.spyOn(process, "kill")
      .mockImplementationOnce(() => { throw Object.assign(new Error("kill EPERM"), { code: "EPERM" }); })
      .mockImplementationOnce(() => { throw Object.assign(new Error("kill ESRCH"), { code: "ESRCH" }); });
    try {
      assert.deepEqual([new ProcessSignaller().isRunning(4_242), new ProcessSignaller().isRunning(4_242)], [true, false]);
      assert.deepEqual(kill.mock.calls, [[4_242, 0], [4_242, 0]]);
    }
    finally {
      kill.mockRestore();
    }
  });
});
