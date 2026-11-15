/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import type { IPtyProcess } from "../../src/interfaces/i-pty-process.ts";
import { StartedShell } from "../../src/models/started-shell.ts";
import { DeferredPtyProcess } from "../../src/services/deferred-pty-process.ts";
import { FakePtyProcess } from "../fixtures/fake-pty-process.fixture.ts";

describe("StartedShell", () => {
  it("holds its process, nonce, note and the TEMP it started with, with no deferred start", () => {
    const process: FakePtyProcess = new FakePtyProcess();
    const shell: StartedShell = new StartedShell(process, "n1", true, null, "/tmp");

    assert.equal(shell.process, process);
    assert.equal(shell.nonce, "n1");
    assert.equal(shell.printsNote, true);
    assert.equal(shell.deferred, null);
    assert.equal(shell.temporaryFolder, "/tmp");
  });

  it("holds the deferred start it was given, with no nonce and no TEMP", () => {
    const deferred: DeferredPtyProcess = new DeferredPtyProcess((): Promise<IPtyProcess> => Promise.resolve(new FakePtyProcess()), 80, 24);
    const shell: StartedShell = new StartedShell(deferred, null, false, deferred, null);

    assert.equal(shell.process, deferred);
    assert.equal(shell.nonce, null);
    assert.equal(shell.printsNote, false);
    assert.equal(shell.deferred, deferred);
    assert.equal(shell.temporaryFolder, null);
  });
});
