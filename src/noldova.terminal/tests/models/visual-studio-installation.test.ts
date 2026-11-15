/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { ArgumentException } from "@noldova/context.exceptions";
import { describe, it } from "vitest";

import { VisualStudioInstallation } from "../../src/models/visual-studio-installation.ts";

describe("VisualStudioInstallation", () => {
  it("keeps the installation", () => {
    const installation: VisualStudioInstallation = new VisualStudioInstallation("e7143cad", "Visual Studio Professional 2026", "C:\\VS");

    assert.deepEqual([installation.instanceId, installation.name, installation.path], ["e7143cad", "Visual Studio Professional 2026", "C:\\VS"]);
  });

  it("refuses blank values, and values longer than the protocol takes", () => {
    const parameterOf = (create: () => unknown): string | null => {
      try {
        create();
        return null;
      }
      catch (error: unknown) {
        if (!(error instanceof ArgumentException))
          throw error;
        return error.parameterName ?? null;
      }
    };

    assert.deepEqual([
      parameterOf(() => new VisualStudioInstallation(" ", "n", "p")),
      parameterOf(() => new VisualStudioInstallation("i", "", "p")),
      parameterOf(() => new VisualStudioInstallation("i", "n", " ")),
      parameterOf(() => new VisualStudioInstallation("i".repeat(201), "n", "p")),
      parameterOf(() => new VisualStudioInstallation("i", "n".repeat(201), "p")),
      parameterOf(() => new VisualStudioInstallation("i", "n", "p".repeat(4_097))),
      parameterOf(() => new VisualStudioInstallation("i".repeat(200), "n".repeat(200), "p".repeat(4_096)))
    ], ["instanceId", "name", "path", "instanceId", "name", "path", null]);
  });
});
