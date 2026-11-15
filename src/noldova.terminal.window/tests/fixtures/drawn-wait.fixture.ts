/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { expect, vi } from "vitest";

export class DrawnWait {
  public static readonly milliseconds: number = 10_000;

  public static async untilAsync<TDrawn>(what: string, read: () => Promise<TDrawn>, expected: TDrawn): Promise<void> {
    let drawn: TDrawn | undefined;
    try {
      await vi.waitFor(async () => {
        drawn = await read();
        expect(drawn).toEqual(expected);
      }, { timeout: DrawnWait.milliseconds });
    }
    catch (error) {
      throw new Error(`${what} never drew ${JSON.stringify(expected)} within ${DrawnWait.milliseconds} ms; it last drew ${JSON.stringify(drawn) ?? "nothing"}`,
        { cause: error });
    }
  }
}
