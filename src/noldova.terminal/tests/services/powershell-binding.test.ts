/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { PowerShellBinding } from "../../src/services/powershell-binding.ts";

function bindsWildcardPath(binding: PowerShellBinding, line: string): boolean {
  return binding.bindsWildcardPath(line.split(" ").slice(0, -1));
}

describe("PowerShellBinding", () => {
  const posix: PowerShellBinding = new PowerShellBinding(false);
  const windows: PowerShellBinding = new PowerShellBinding(true);

  it("binds the first positional word, and -Path's value, to the path", () => {
    for (const line of ["Get-Item e", "Get-Item -Path e", "gi -path e", "Set-Content e", "Test-Path e"])
      assert.equal(bindsWildcardPath(posix, line), true, line);
  });

  it("matches a parameter by its name, an alias or a unique prefix, common ones too, and skips a switch or a value", () => {
    for (const line of ["rm -r e", "Remove-Item -Force -r e", "gi -Pa e", "gci -s e", "gci -Filter x e", "gci -filt x e", "Copy-Item -Destination d e",
      "gci -Verbose e", "gci -vb e", "gci -db e", "gci -Verbose:$true e", "Remove-Item -wi e", "Remove-Item -cf e", "gci -ea Stop e",
      "gc -Tail 5 e", "gc -Head 5 e", "gci -fi x e"])
      assert.equal(bindsWildcardPath(line.startsWith("rm") ? windows : posix, line), true, line);
  });

  it("binds a later positional word, another parameter's value, or a word after the path was named, elsewhere", () => {
    for (const line of ["Copy-Item a e", "Copy-Item -r a e", "Copy-Item -Path a -Destination e", "Get-Item -LiteralPath e", "gi -LP e",
      "gi -PSPath e", "gi -Path a e", "gi -LiteralPath:a e", "gi -lit a e", "gci a e", "Rename-Item a e", "Set-Content a e", "Get-Item a b e"])
      assert.equal(bindsWildcardPath(posix, line), false, line);
  });

  it("binds nothing for a parameter PowerShell refuses as unknown or ambiguous, another command, or the command's own word", () => {
    for (const line of ["gci -f e", "gci -f x e", "gi -Recurse e", "gi -x e", "gi - e", "node e", "Get-Foo e", "e"])
      assert.equal(bindsWildcardPath(posix, line), false, line);
  });

  it("matches the cmdlet's own and common parameters before the file system's dynamic ones, which match only when none of those does", () => {
    for (const line of ["gci -r e", "ls -r e", "gci -fo e", "gci -fi x e", "gc -r 5 e", "gci -fol e", "gci -rea e", "gc -ra e", "Test-Path -ol x e",
      "gc -Raw e", "gc -wai e"])
      assert.equal(bindsWildcardPath(windows, line), true, line);
    for (const line of ["gc -r e", "gci -fil e", "gc -t e"])
      assert.equal(bindsWildcardPath(windows, line), false, line);
  });

  it("binds every word after -- as positional, a dash first too", () => {
    for (const line of ["Remove-Item -- e", "Remove-Item -Force -- e", "gi -- -e"])
      assert.equal(bindsWildcardPath(windows, line), true, line);
    for (const line of ["Copy-Item -- a e", "gi -- -Path e", "gi -Path -- e"])
      assert.equal(bindsWildcardPath(windows, line), false, line);
  });

  it("counts ac, cat, cp, ls, mv, rm and rmdir as the cmdlets' aliases only on Windows", () => {
    for (const line of ["ac e", "cat e", "cp e", "ls e", "mv e", "rm e", "rmdir e"]) {
      assert.equal(bindsWildcardPath(windows, line), true, line);
      assert.equal(bindsWildcardPath(posix, line), false, line);
    }
  });
});
