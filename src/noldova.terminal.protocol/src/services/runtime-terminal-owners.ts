/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { PackageCopiesException } from "../exceptions/package-copies.exception.ts";
import { Resources } from "../resources.ts";

const BRAND: unique symbol = Symbol.for(Resources.runtimeOwnersBrand);

export abstract class RuntimeTerminalOwners {
  public get [BRAND](): true {
    return true;
  }

  public static [Symbol.hasInstance](value: unknown): boolean {
    if (Function.prototype[Symbol.hasInstance].call(this, value))
      return true;
    if (Function.prototype[Symbol.hasInstance].call(RuntimeTerminalOwners, value))
      return false;
    if (typeof value === "object" && value !== null && BRAND in value)
      throw new PackageCopiesException();
    return false;
  }

  public abstract closeAsync(owner: string): Promise<void>;

  public abstract bindAgentSession(agentSessionId: string, owner: string): void;

  public abstract unbindAgentSession(agentSessionId: string): void;
}
