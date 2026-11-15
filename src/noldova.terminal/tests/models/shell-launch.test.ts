/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { ShellLaunch } from "../../src/models/shell-launch.ts";

describe("ShellLaunch", () => {
  it("holds its file, arguments, environment, nonce, nonce file and note flag", () => {
    const environment: Readonly<Record<string, string>> = { TERM: "xterm-256color" };
    const launch: ShellLaunch = new ShellLaunch("/bin/bash", ["--login"], environment, "n1", "/tmp/nonce", true);

    assert.equal(launch.file, "/bin/bash");
    assert.deepEqual(launch.args, ["--login"]);
    assert.equal(launch.environment, environment);
    assert.equal(launch.nonce, "n1");
    assert.equal(launch.nonceFile, "/tmp/nonce");
    assert.equal(launch.printsNote, true);
  });

  it("takes a single argument line and has no nonce file and prints no note by default", () => {
    const launch: ShellLaunch = new ShellLaunch("cmd.exe", "/k prompt $P$G", {}, null);

    assert.equal(launch.args, "/k prompt $P$G");
    assert.equal(launch.nonce, null);
    assert.equal(launch.nonceFile, null);
    assert.equal(launch.printsNote, false);
  });
});
