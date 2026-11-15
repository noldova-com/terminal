/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { InheritedEnvironment } from "../../src/services/inherited-environment.ts";

describe("InheritedEnvironment", () => {
  it("reads the environment it was given, each time", async () => {
    const environment: Readonly<Record<string, string | undefined>> = { SHELL: "/bin/zsh", UNSET: undefined };
    const source: InheritedEnvironment = new InheritedEnvironment(environment);

    assert.equal(await source.readAsync(), environment);
    assert.equal(await source.readAsync(), environment);
  });

  it("has nothing to start or end", async () => {
    const environment: Readonly<Record<string, string | undefined>> = { SHELL: "/bin/zsh" };
    const source: InheritedEnvironment = new InheritedEnvironment(environment);

    source.start();
    source.end();

    assert.equal(await source.readAsync(), environment);
  });
});
