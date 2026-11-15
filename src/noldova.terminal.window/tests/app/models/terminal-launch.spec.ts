/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TerminalShellKind } from "@noldova/terminal.protocol";
import { describe, expect, it } from "vitest";

import { TerminalLaunch } from "../../../src/app/models/terminal-launch.ts";

describe("TerminalLaunch", () => {
  it("holds each field it is given", () => {
    const launch: TerminalLaunch = new TerminalLaunch("/work", { API_URL: "https://example.com" }, "Run login to sign in.", "Sign in",
      "npm run login", false, 8, [TerminalShellKind.Bash, TerminalShellKind.Zsh]);

    expect([launch.folder, launch.environment, launch.notice, launch.title, launch.command, launch.opensTab, launch.minimumRows,
      launch.shellKinds]).toEqual(["/work", { API_URL: "https://example.com" }, "Run login to sign in.", "Sign in", "npm run login", false, 8,
      ["Bash", "Zsh"]]);
  });

  it("opens a tab with no variables, notice, title, command, minimum rows or shell kinds by default", () => {
    const launch: TerminalLaunch = new TerminalLaunch(null);

    expect([launch.folder, launch.environment, launch.notice, launch.title, launch.command, launch.opensTab, launch.minimumRows,
      launch.shellKinds]).toEqual([null, {}, null, null, null, true, null, []]);
  });

  it("keeps its own copy of the shell kinds", () => {
    const kinds: TerminalShellKind[] = [TerminalShellKind.PowerShell];
    const launch: TerminalLaunch = new TerminalLaunch(null, {}, null, null, null, true, null, kinds);
    kinds.push(TerminalShellKind.Bash);

    expect(launch.shellKinds).toEqual(["PowerShell"]);
  });
});
