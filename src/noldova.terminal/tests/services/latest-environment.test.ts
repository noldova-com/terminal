/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it, vi } from "vitest";

import type { IEnvironmentSource } from "../../src/interfaces/i-environment-source.ts";
import { LatestEnvironment } from "../../src/services/latest-environment.ts";

type Environment = Readonly<Record<string, string | undefined>>;

class HeldSource implements IEnvironmentSource {
  public readonly reads: PromiseWithResolvers<Environment | null>[] = [];

  public start(): void {
  }

  public readAsync(): Promise<Environment | null> {
    const read: PromiseWithResolvers<Environment | null> = Promise.withResolvers<Environment | null>();
    this.reads.push(read);
    return read.promise;
  }

  public end(): void {
  }
}

describe("LatestEnvironment", () => {
  it("gives the inherited environment at once while the first read is held, starts no second read meanwhile, and gives the read once it finishes", async () => {
    const source: HeldSource = new HeldSource();
    const latest: LatestEnvironment = new LatestEnvironment(source, { NAME: "inherited" });

    const held: readonly Environment[] = [latest.read(), latest.read()];
    const startedWhileHeld: number = source.reads.length;
    source.reads[0]?.resolve({ NAME: "read" });
    await vi.waitFor(() => assert.deepEqual(latest.read(), { NAME: "read" }));

    assert.deepEqual([held, startedWhileHeld, source.reads.length], [[{ NAME: "inherited" }, { NAME: "inherited" }], 1, 2]);
  });

  it("keeps the environment it had when a read fails, and starts another read next time", async () => {
    const source: HeldSource = new HeldSource();
    const latest: LatestEnvironment = new LatestEnvironment(source, { NAME: "inherited" });

    latest.read();
    source.reads[0]?.reject(new Error("unreadable"));
    await vi.waitFor(() => {
      latest.read();
      assert.equal(source.reads.length, 2);
    });

    assert.deepEqual(latest.read(), { NAME: "inherited" });
  });

  it("keeps the last finished read when a later read gives nothing, and gives a read asked for directly the inherited environment then", async () => {
    const source: HeldSource = new HeldSource();
    const latest: LatestEnvironment = new LatestEnvironment(source, { NAME: "inherited" });

    const first: Promise<Environment> = latest.readAsync();
    source.reads[0]?.resolve({ NAME: "read" });
    const read: Environment = await first;
    const second: Promise<Environment> = latest.readAsync();
    source.reads[1]?.resolve(null);
    const unread: Environment = await second;

    assert.deepEqual([read, unread, latest.read()], [{ NAME: "read" }, { NAME: "inherited" }, { NAME: "read" }]);
  });

  it("waits for a read asked for directly, gives it from then on, and passes on a read's failure", async () => {
    const source: HeldSource = new HeldSource();
    const latest: LatestEnvironment = new LatestEnvironment(source, { NAME: "inherited" });
    const failure: Error = new Error("unreadable");

    const reading: Promise<Environment> = latest.readAsync();
    source.reads[0]?.resolve({ NAME: "started" });
    const read: Environment = await reading;
    const failing: Promise<Environment> = latest.readAsync();
    source.reads[1]?.reject(failure);

    await assert.rejects(failing, failure);
    assert.deepEqual([read, latest.read()], [{ NAME: "started" }, { NAME: "started" }]);
  });
});
