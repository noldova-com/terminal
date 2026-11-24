/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { inspect, isDeepStrictEqual } from "node:util";

import { Assert } from "@noldova/context.testing";

export class Expect {
  private static readonly depth: number = 8;

  public static same(expected: unknown, actual: unknown, message?: string): void {
    if (!isDeepStrictEqual(actual, expected))
      Assert.fail(message ?? `Expected ${Expect.shown(expected)}, but got ${Expect.shown(actual)}.`);
  }

  public static throwsMatching(action: () => unknown, expected: Readonly<Record<string, unknown>>): Error {
    const error: Error = Assert.throws(action, Error);
    for (const [key, value] of Object.entries(expected))
      Expect.same(value, Reflect.get(error, key), `The ${error.name} thrown has ${key} ${Expect.shown(Reflect.get(error, key))}, not ${Expect.shown(value)}: ${error.message}`);
    return error;
  }

  private static shown(value: unknown): string {
    return inspect(value, { depth: Expect.depth });
  }
}
