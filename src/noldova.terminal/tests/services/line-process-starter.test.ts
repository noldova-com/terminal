/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { FakeRuntimePartContext } from "@noldova/desktop.runtime/testing";
import { describe, it } from "vitest";

import type { ILineProcess } from "../../src/interfaces/i-line-process.ts";
import { LineProcessStarter } from "../../src/services/line-process-starter.ts";
import { SpawnedPrograms } from "../fixtures/spawned-programs.fixture.ts";

describe("LineProcessStarter", () => {
  it("starts a program through the part's context and hands on its lines", async () => {
    const programs: SpawnedPrograms = new SpawnedPrograms();
    const context: FakeRuntimePartContext = new FakeRuntimePartContext();
    context.answer("startProcessAsync", t => programs.startAsync(t));
    const line: PromiseWithResolvers<string> = Promise.withResolvers<string>();
    let child: ILineProcess | undefined;
    try {
      child = new LineProcessStarter(context).start(process.execPath, ["-e", "process.stdout.write('ready\\n'); setInterval(() => {}, 1000);"], {
        onLine: t => line.resolve(t),
        onExit: reason => line.reject(new Error(`The program ended before its line: ${reason}`))
      });

      assert.equal(await line.promise, "ready");
      assert.deepEqual(programs.requests.map(t => t.program), [process.execPath]);
    }
    finally {
      child?.kill();
      await programs.stopAllAsync();
    }
    assert.deepEqual(programs.running, []);
  });
});
