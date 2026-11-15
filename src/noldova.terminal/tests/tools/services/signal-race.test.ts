/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { SignalRace } from "../../../src/tools/services/signal-race.ts";

function createError(): Error {
  return new Error("ended");
}

describe("SignalRace", () => {
  it("returns the task's result when it settles before the signal ends", async () => {
    const controller: AbortController = new AbortController();

    assert.equal(await SignalRace.raceAsync(Promise.resolve(1), controller.signal, createError), 1);
    controller.abort();
  });

  it("passes on the task's failure", async () => {
    await assert.rejects(SignalRace.raceAsync(Promise.reject(new Error("failed")), new AbortController().signal, createError), { message: "failed" });
  });

  it("fails with the given error when the signal ends first, and leaves the task", async () => {
    const controller: AbortController = new AbortController();
    const { promise: task, resolve } = Promise.withResolvers<number>();
    const race: Promise<number> = SignalRace.raceAsync(task, controller.signal, createError);

    controller.abort();

    await assert.rejects(race, { message: "ended" });
    resolve(1);
  });

  it("fails at once when the signal has already ended, even when the task has settled", async () => {
    const controller: AbortController = new AbortController();
    controller.abort();

    await assert.rejects(SignalRace.raceAsync(Promise.resolve(1), controller.signal, createError), { message: "ended" });
  });
});
