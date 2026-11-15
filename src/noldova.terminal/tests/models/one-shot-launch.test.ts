/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { createRequire } from "node:module";

import { describe, it } from "vitest";

import { OneShotLaunch } from "../../src/models/one-shot-launch.ts";

const NODE_PTY: { argsToCommandLine(file: string, args: readonly string[]): string } =
  createRequire(import.meta.url)("node-pty/lib/windowsPtyAgent.js") as { argsToCommandLine(file: string, args: readonly string[]): string };

describe("OneShotLaunch", () => {
  it("shows an argument list on one line as node-pty quotes it for a Windows pseudo console", () => {
    const lists: readonly (readonly string[])[] = [
      ["-d", "Ubuntu", "-e", "sh", "-c", "echo \"a b\"", ""],
      ["-NoProfile", "-Command", "Write-Output 'a\\b'; dir \"C:\\Program Files\\\""],
      ["\"already quoted\"", "\"lopsided", "tab\there", " ", "trailing\\", "trailing space\\", "back\\\\\"quote", "plain"]
    ];

    for (const args of lists) {
      const launch: OneShotLaunch = new OneShotLaunch("C:\\Program Files\\WSL\\wsl.exe", args);

      assert.equal(launch.commandLine, NODE_PTY.argsToCommandLine("C:\\Program Files\\WSL\\wsl.exe", args));
    }
    assert.equal(new OneShotLaunch("wsl.exe", ["-c", "echo \"a b\"", ""]).commandLine, "wsl.exe -c \"echo \\\"a b\\\"\" \"\"");
  });

  it("shows a command line as it is, after its program", () => {
    const launch: OneShotLaunch = new OneShotLaunch("C:\\Program Files\\Shells\\cmd.exe", "/d /s /c \"dir \"C:\\Program Files\"\"");

    assert.deepEqual([launch.args, launch.environment, launch.commandLine],
      ["/d /s /c \"dir \"C:\\Program Files\"\"", {}, "\"C:\\Program Files\\Shells\\cmd.exe\" /d /s /c \"dir \"C:\\Program Files\"\""]);
  });

  it("shows each variable a command line reads in its place, and starts with the variables", () => {
    const launch: OneShotLaunch = new OneShotLaunch("cmd.exe", "/v:on /c \"!COMMAND! & !COMMAND! & !OTHER!\"", { COMMAND: "echo \"a & b\"" });

    assert.deepEqual([launch.environment, launch.commandLine],
      [{ COMMAND: "echo \"a & b\"" }, "cmd.exe /v:on /c \"echo \"a & b\" & echo \"a & b\" & !OTHER!\""]);
  });
});
