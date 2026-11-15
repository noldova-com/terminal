/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { spawnSync } from "node:child_process";
import { uptime } from "node:os";
import { join } from "node:path";

import * as nodePty from "node-pty";
import { describe, it } from "vitest";

const IS_WINDOWS: boolean = process.platform === "win32";
const POWERSHELL: string = join(process.env["SystemRoot"] ?? "C:\\Windows", "System32", "WindowsPowerShell", "v1.0", "powershell.exe");
const STARTS: number = 10;
const CAP_MS: number = 180_000;

function promptAsync(file: string): Promise<readonly number[]> {
  return new Promise<readonly number[]>(resolve => {
    const started: number = performance.now();
    const terminal: nodePty.IPty = nodePty.spawn(file, ["-NoLogo"], { cols: 120, rows: 30, cwd: process.cwd(), env: process.env });
    let output: string = "";
    let first: number = -1;
    terminal.onData(data => {
      if (first < 0)
        first = performance.now() - started;
      output += data;
      if (/PS [^\r\n]*> $/u.test(output)) {
        const prompted: number = performance.now() - started;
        terminal.kill();
        resolve([Math.round(first), Math.round(prompted)]);
      }
    });
  });
}

describe("probe: Windows PowerShell's cold start", () => {
  it("times powershell.exe's starts from the job's start", { timeout: 30 * 60_000 }, async context => {
    context.skip(!IS_WINDOWS, "Windows only.");
    for (let index: number = 0; index < STARTS; index++) {
      const bootSeconds: number = Math.round(uptime());
      const started: number = performance.now();
      const exitRun = spawnSync(POWERSHELL, ["-NoProfile", "-NonInteractive", "-Command", "exit 7"], { timeout: CAP_MS });
      const exitMs: number = Math.round(performance.now() - started);
      const aclStarted: number = performance.now();
      spawnSync(POWERSHELL, ["-NoProfile", "-NonInteractive", "-Command", "$null = Get-Acl -LiteralPath $env:TEMP"], { timeout: CAP_MS });
      const aclMs: number = Math.round(performance.now() - aclStarted);
      const [firstOutputMs, promptMs] = await promptAsync(POWERSHELL);
      const pwshStarted: number = performance.now();
      spawnSync("pwsh.exe", ["-NoProfile", "-NonInteractive", "-Command", "exit 7"], { timeout: CAP_MS });
      const pwshMs: number = Math.round(performance.now() - pwshStarted);
      console.log(`PROBE start=${index} boot=${bootSeconds}s exit=${exitMs}ms status=${exitRun.status} acl=${aclMs}ms firstOutput=${firstOutputMs}ms prompt=${promptMs}ms pwsh=${pwshMs}ms`);
    }
  });
});
