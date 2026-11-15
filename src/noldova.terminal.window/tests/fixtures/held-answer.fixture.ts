/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonValue } from "@noldova/context.json";

export class HeldAnswer {
  public resolve: (value: JsonValue) => void = () => undefined;
  public reject: (reason: Error) => void = () => undefined;
  public readonly promise: Promise<JsonValue> = new Promise<JsonValue>((resolve, reject) => {
    this.resolve = resolve;
    this.reject = reject;
  });
}
