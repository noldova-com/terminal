/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonObject } from "@noldova/context.json";

import { Resources } from "../resources.ts";
import { ArgumentValidator } from "../services/argument.validator.ts";
import { ProtocolReader } from "../services/protocol.reader.ts";

export class WindowsPty {
  public readonly buildNumber: number;

  public constructor(buildNumber: number) {
    ArgumentValidator.requireIntegerInRange(Resources.buildNumberField, buildNumber, 0, Resources.maximumBuildNumber);

    this.buildNumber = buildNumber;
  }

  public static fromJson(value: unknown): WindowsPty {
    return WindowsPty.fromReader(ProtocolReader.fromValue(value));
  }

  public static fromReader(reader: ProtocolReader): WindowsPty {
    reader.allowOnly([Resources.backendField, Resources.buildNumberField]);
    reader.readOneOf(Resources.backendField, [Resources.conptyBackend]);
    return reader.create(() => new WindowsPty(reader.readInteger(Resources.buildNumberField, 0, Resources.maximumBuildNumber)));
  }

  public toJson(): JsonObject {
    return { backend: Resources.conptyBackend, buildNumber: this.buildNumber };
  }
}
