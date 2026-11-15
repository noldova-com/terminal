/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { spawnSync, type SpawnSyncReturns } from "node:child_process";
import { statSync } from "node:fs";
import { join } from "node:path";

export class PrivateFolder {
  private static readonly waitMilliseconds: number = 20_000;
  private static readonly windowsPowerShellColdStartMilliseconds: number = 60_000;
  private static readonly pathSeparator: string = "--noldova-path--";
  private static readonly windowsReaders: readonly string[] = ["S-1-3-4", "S-1-5-18", "S-1-5-32-544"];
  private static readonly windowsOwners: readonly string[] = ["S-1-5-32-544"];
  private static readonly macEntry: RegExp = /^\s*\d+: /mu;
  public static readonly linuxAclMissing: string | null = process.platform === "linux" && !(PrivateFolder.has("setfacl") && PrivateFolder.has("getfacl"))
    ? "setfacl and getfacl are not installed." : null;

  public static passOnRead(folder: string): void {
    if (process.platform === "win32")
      PrivateFolder.run(join(process.env["SystemRoot"] ?? "", "System32", "icacls.exe"), [folder, "/grant", "*S-1-5-32-545:(OI)(CI)R"]);
    else if (process.platform === "darwin")
      PrivateFolder.run("/bin/chmod", ["+a", "everyone allow read,list,search,file_inherit,directory_inherit", folder]);
  }

  public static passOnLinuxDefaultAcl(folder: string): void {
    PrivateFolder.run("setfacl", ["-d", "-m", "u:nobody:rx,o::rx", folder]);
  }

  public static assertPrivate(...paths: readonly string[]): void {
    if (process.platform === "win32") {
      PrivateFolder.assertWindowsReaders(paths);
      return;
    }
    for (const path of paths) {
      assert.equal(statSync(path).mode & 0o077, 0, `Others can read ${path} by its mode.`);
      if (process.platform === "darwin") {
        const listing: string = PrivateFolder.run("/bin/ls", ["-lde", path]);
        assert.doesNotMatch(listing, PrivateFolder.macEntry, `${path} has an ACL: ${listing}`);
      }
    }
  }

  public static assertLinuxEntriesMasked(path: string): void {
    const entries: string[][] = PrivateFolder.run("getfacl", ["-p", "--omit-header", path]).split("\n").map(t => t.split("#")[0]?.trim() ?? "")
      .filter(t => t !== "").map(t => t.split(":"));
    const mask: string = entries.find(t => t[0] === "mask")?.[2] ?? "rwx";
    const granted: string[] = entries.filter(t => t[0] !== "mask" && !(t[0] === "user" && t[1] === "") && !t[0]?.startsWith("default"))
      .filter(t => [...t[2] ?? ""].some((permission, index) => permission !== "-" && (t[0] === "other" || mask[index] !== "-")))
      .map(t => t.join(":"));
    assert.deepEqual(granted, [], `Others can read ${path}.`);
  }

  private static has(program: string): boolean {
    return spawnSync(program, ["--version"], { encoding: "utf8", timeout: PrivateFolder.waitMilliseconds }).error === undefined;
  }

  private static assertWindowsReaders(paths: readonly string[]): void {
    const literals: string = paths.map(t => `'${t.replaceAll("'", "''")}'`).join(", ");
    const script: string = `$account = [System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value
      foreach ($path in @(${literals})) {
        $acl = Get-Acl -LiteralPath $path; '${PrivateFolder.pathSeparator}'; $account
        $acl.GetOwner([System.Security.Principal.SecurityIdentifier]).Value
        $acl.GetAccessRules($true, $true, [System.Security.Principal.SecurityIdentifier]) | Where-Object AccessControlType -eq Allow |
        ForEach-Object { $_.IdentityReference.Value }
      }`;
    const output: string = PrivateFolder.run("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script],
      PrivateFolder.windowsPowerShellColdStartMilliseconds);
    const blocks: readonly string[] = output.split(PrivateFolder.pathSeparator).slice(1);
    assert.equal(blocks.length, paths.length, `Get-Acl answered for ${blocks.length} of ${paths.length} folders: ${output}`);
    paths.forEach((path, index) => {
      const [account = "", owner = "", ...readers]: string[] = (blocks[index] ?? "").split(/\r?\n/u).filter(t => t !== "");
      assert.ok([account, ...PrivateFolder.windowsOwners].includes(owner), `${path} is owned by ${owner}, not ${account}.`);
      assert.ok(readers.includes(account) || readers.includes("S-1-3-4"), `${account} can't read ${path}: ${readers.join(", ")}.`);
      assert.deepEqual([...new Set(readers)].filter(t => t !== account && !PrivateFolder.windowsReaders.includes(t)), [], `Others can read ${path}.`);
    });
  }

  private static run(file: string, args: readonly string[], timeoutMilliseconds: number = PrivateFolder.waitMilliseconds): string {
    const environment: Record<string, string | undefined> = Object.fromEntries(Object.entries(process.env).filter(t => t[0].toLowerCase() !== "psmodulepath"));
    const result: SpawnSyncReturns<string> = spawnSync(file, args, { encoding: "utf8", timeout: timeoutMilliseconds, env: environment });
    assert.equal(result.status, 0, `${file} ${args.join(" ")} failed: ${result.stdout}${result.stderr}`);
    return result.stdout;
  }
}
