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
import { SystemRequirements } from "../../src/services/system-requirements.ts";

function glibc(version: unknown): unknown {
  return { header: { glibcVersionRuntime: version } };
}

describe("SystemRequirements", () => {
  it("refuses Windows below build 17763 and says which build it found", () => {
    assert.deepEqual(SystemRequirements.findShortfall("win32", "10.0.17134", null), new SystemShortfall(SystemRequirement.WindowsBuild, "17134"));
  });

  for (const release of ["10.0.17763", "10.0.26100"])
    it(`takes Windows release ${release}`, () => {
      assert.equal(SystemRequirements.findShortfall("win32", release, null), null);
    });

  for (const release of ["10.0", "unknown", "10.0.26100abc"])
    it(`refuses Windows release ${release}, which names no build, and says what it found`, () => {
      assert.deepEqual(SystemRequirements.findShortfall("win32", release, null), new SystemShortfall(SystemRequirement.WindowsBuild, release));
    });

  it("reads the build of a Windows release, and none from one that names no build", () => {
    assert.deepEqual(["10.0.26100", "10.0", "10.0.26100abc"].map(t => SystemRequirements.readWindowsBuild(t)), [26_100, null, null]);
  });

  it("refuses Linux below glibc 2.28 and says which glibc it found", () => {
    assert.deepEqual(SystemRequirements.findShortfall("linux", "6.8.0", glibc("2.27")), new SystemShortfall(SystemRequirement.Glibc, "2.27"));
    assert.notEqual(SystemRequirements.findShortfall("linux", "6.8.0", glibc("1.99")), null);
  });

  for (const [description, report] of [
    ["glibc 2.28", glibc("2.28")],
    ["glibc 2.39", glibc("2.39")],
    ["glibc 3.0", glibc("3.0")],
    ["an unreadable glibc version", glibc("unknown")],
    ["a glibc version that isn't text", glibc(228)],
    ["no glibc, as on musl", { header: {} }],
    ["a report without a header", {}],
    ["a header that isn't an object", { header: null }],
    ["no report", null]
  ] as const)
    it(`takes Linux with ${description}`, () => {
      assert.equal(SystemRequirements.findShortfall("linux", "6.8.0", report), null);
    });

  it("takes macOS whatever its release", () => {
    assert.equal(SystemRequirements.findShortfall("darwin", "18.0.0", glibc("2.0")), null);
  });
});
