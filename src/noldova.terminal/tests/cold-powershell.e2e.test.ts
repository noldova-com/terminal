/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { spawnSync, type SpawnSyncReturns } from "node:child_process";
import { join } from "node:path";

import { describe, it } from "vitest";

const IS_WINDOWS: boolean = process.platform === "win32";
const POWERSHELL: string = join(process.env["SystemRoot"] ?? "C:\\Windows", "System32", "WindowsPowerShell", "v1.0", "powershell.exe");
const CAP_MS: number = 180_000;
const SPLIT: string = "$s = [Diagnostics.Stopwatch]::StartNew(); $null = Get-Acl -LiteralPath $env:TEMP; \"inside=$($s.ElapsedMilliseconds)\"";

function time(label: string, command: string, environment: NodeJS.ProcessEnv): void {
  const started: number = performance.now();
  const result: SpawnSyncReturns<string> = spawnSync(POWERSHELL, ["-NoProfile", "-NonInteractive", "-Command", command], { encoding: "utf8", timeout: CAP_MS, env: environment });
  const total: number = Math.round(performance.now() - started);
  console.log(`PROBE ${label}: total=${total}ms status=${result.status} out=${result.stdout.trim().replaceAll(/\s+/gu, " ").slice(0, 400)}`);
}

describe("probe: Windows PowerShell's slow Get-Acl", () => {
  it("splits Get-Acl's time between the process and the cmdlet, by execution policy", { timeout: 30 * 60_000 }, context => {
    context.skip(!IS_WINDOWS, "Windows only.");
    const plain: NodeJS.ProcessEnv = { ...process.env };
    delete plain["PSExecutionPolicyPreference"];
    time("policies", "Get-ExecutionPolicy -List | ForEach-Object { \"$($_.Scope)=$($_.ExecutionPolicy)\" }", plain);
    for (let index: number = 0; index < 3; index++) {
      time(`default ${index}`, SPLIT, plain);
      time(`remote-signed ${index}`, SPLIT, { ...plain, PSExecutionPolicyPreference: "RemoteSigned" });
      time(`bypass ${index}`, SPLIT, { ...plain, PSExecutionPolicyPreference: "Bypass" });
      time(`exit ${index}`, "exit 0", plain);
      time(`module only ${index}`, "$s = [Diagnostics.Stopwatch]::StartNew(); Import-Module Microsoft.PowerShell.Security; \"inside=$($s.ElapsedMilliseconds)\"", plain);
      time(`utility ${index}`, "$s = [Diagnostics.Stopwatch]::StartNew(); $null = Get-Date | Out-String; \"inside=$($s.ElapsedMilliseconds)\"", plain);
    }
  });
});
