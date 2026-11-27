/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { defineConfig } from "vitest/config";

export default defineConfig({
  cacheDir: "_build/vite",
  test: {
    projects: [
      "src/noldova.terminal",
      {
        extends: true,
        test: {
          name: "scripts",
          include: ["scripts/tests/**/*.test.ts"]
        }
      }
    ],
    coverage: {
      provider: "v8",
      include: [
        "src/**/*.ts"
      ],
      exclude: [
        "**/tests/**",
        "src/*/vitest.config.ts",
        "src/noldova.terminal.protocol/**",
        "src/noldova.terminal.window/**"
      ],
      reporter: [
        "text",
        "json-summary"
      ],
      reportsDirectory: "_build/coverage",
      thresholds: {
        statements: 100,
        branches: 100,
        functions: 100,
        lines: 100
      }
    }
  }
});
