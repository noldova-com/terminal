/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { spawnSync, type SpawnSyncReturns } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { FakeModuleLog, FakeModuleSettings } from "@noldova/desktop.runtime/testing";
import { TerminalShellKind } from "@noldova/terminal.protocol";
import { afterAll, beforeAll, describe, it } from "vitest";

import { Shell } from "../../src/models/shell.ts";
import type { ShellLaunch } from "../../src/models/shell-launch.ts";
import { ShellIntegration } from "../../src/services/shell-integration.ts";
import { FakeFileSystemWriter } from "../fixtures/fake-file-system-writer.fixture.ts";

const LOGIN_SHELL: string = "/bin/zsh";
const RUN_MS: number = 20_000;
const ODD_ARGUMENTS: readonly string[] = ["-NoLogo", "a b", "it's", "say \"hi\"", "$HOME", "`echo x`", "-$x", "--", ""];
const STAND_IN: string = "#!/bin/sh\nfor argument in \"$@\"; do printf '<%s>\\n' \"$argument\"; done\n" +
  "printf 'checked=%s\\n' \"${__PWSH_LOGIN_CHECKED-unset}\"\nprintf 'path=%s\\n' \"$PATH\"\n";
const ZSH_FILES: readonly string[] = [".zshenv", ".zprofile", ".zshrc", ".zlogin"];

describe("a login pwsh started on macOS through zsh as a login sh", () => {
  let folder: string = "";
  let home: string = "";
  let pwsh: string = "";

  beforeAll(async () => {
    folder = await mkdtemp(join(tmpdir(), "noldova-terminal-pwsh-login-"));
    home = join(folder, "home");
    pwsh = join(folder, "Power Shell", "pwsh");
    await mkdir(home);
    await mkdir(join(folder, "Power Shell"));
    await writeFile(pwsh, STAND_IN, { encoding: "utf8", mode: 0o755 });
    await writeFile(join(home, ".profile"), "echo profile >> \"$HOME/runs\"\n", "utf8");
    for (const file of ZSH_FILES)
      await writeFile(join(home, file), `echo ${file} >> "$HOME/runs"\n`, "utf8");
  });

  afterAll(async () => {
    await rm(folder, { force: true, recursive: true });
  });

  it("gives pwsh at a path with spaces every argument whole and its login check marked done, after sh's login files ran once and none of zsh's", async context => {
    context.skip(process.platform === "win32" || !existsSync(LOGIN_SHELL), `${LOGIN_SHELL} is not here.`);
    const integration: ShellIntegration = new ShellIntegration(new FakeFileSystemWriter(), "/tmp", new FakeModuleLog(), null, new FakeModuleSettings(), "darwin");
    const launch: ShellLaunch = await integration.prepareAsync(new Shell("pwsh", "PowerShell", TerminalShellKind.PowerShell, pwsh, ["-l", ...ODD_ARGUMENTS], true),
      "0123456789abcdef0123456789abcdef", {});
    const passed: readonly string[] = [launch.args].flat().slice(6);

    const run: SpawnSyncReturns<string> = spawnSync(launch.file, [launch.args].flat(),
      { env: { PATH: "/usr/bin:/bin", HOME: home, ...launch.environment }, encoding: "utf8", timeout: RUN_MS });
    const lines: readonly string[] = run.stdout.split("\n");
    const printed: readonly string[] = lines.filter(t => t.startsWith("<")).map(t => t.slice(1, -1));
    const path: readonly string[] = (lines.find(t => t.startsWith("path="))?.slice(5) ?? "").split(":");

    assert.deepEqual([run.status, run.stderr], [0, ""], run.stdout);
    assert.deepEqual([launch.file, printed.slice(0, ODD_ARGUMENTS.length), printed], [LOGIN_SHELL, ODD_ARGUMENTS, passed]);
    assert.ok(lines.includes("checked=1"), run.stdout);
    assert.equal(await readFile(join(home, "runs"), "utf8"), "profile\n");
    if (process.platform === "darwin")
      for (const listed of (await readFile("/etc/paths", "utf8")).split("\n").filter(t => t !== ""))
        assert.ok(path.includes(listed), `/etc/profile's path_helper did not add ${listed}: ${path.join(":")}`);
  });
});
