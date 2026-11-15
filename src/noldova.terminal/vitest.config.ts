/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { defineProject } from "vitest/config";

export default defineProject({
  test: {
    include: [
      "tests/**/*.test.ts"
    ],
    globalSetup: ["tests/fixtures/dotnet-shared-memory.setup.ts"],
    testTimeout: 70_000,
    hookTimeout: 70_000
  }
});
