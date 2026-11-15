/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { Exception, ExceptionOptions } from "@noldova/context.exceptions";
import { ProcessExit } from "@noldova/desktop.runtime";
import { TerminalShellKind } from "@noldova/terminal.protocol";
import { describe, it } from "vitest";

import { SystemRequirement } from "../../src/enums/system-requirement.ts";
import { AgentTerminalRestartException } from "../../src/exceptions/agent-terminal-restart.exception.ts";
import { CommandExitedException } from "../../src/exceptions/command-exited.exception.ts";
import { DefaultShellNotFoundException } from "../../src/exceptions/default-shell-not-found.exception.ts";
import { EnvironmentExportInvalidException } from "../../src/exceptions/environment-export-invalid.exception.ts";
import { FolderNotFoundException } from "../../src/exceptions/folder-not-found.exception.ts";
import { HostEndedException } from "../../src/exceptions/host-ended.exception.ts";
import { ShellKindNotFoundException } from "../../src/exceptions/shell-kind-not-found.exception.ts";
import { StoredLinesDamagedException } from "../../src/exceptions/stored-lines-damaged.exception.ts";
import { StoredLinesUnwritableException } from "../../src/exceptions/stored-lines-unwritable.exception.ts";
import { TerminalException } from "../../src/exceptions/terminal.exception.ts";
import { UnknownMethodException } from "../../src/exceptions/unknown-method.exception.ts";
import { UnsupportedSystemException } from "../../src/exceptions/unsupported-system.exception.ts";
import { WslDistributionsUnreadableException } from "../../src/exceptions/wsl-distributions-unreadable.exception.ts";
import { StaleTerminalException } from "../../src/tools/exceptions/stale-terminal.exception.ts";

describe("TerminalException", () => {
  it("carries its name, message and cause, as a context Exception", () => {
    const cause: Error = new Error("Disk full.");
    const error: TerminalException = new TerminalException("The terminal failed.", new ExceptionOptions(cause));

    assert.ok(error instanceof Exception);
    assert.equal(error.name, "TerminalException");
    assert.equal(error.message, "The terminal failed.");
    assert.equal(error.cause, cause);
  });

  it("is the base of every exception the runtime owns", () => {
    const errors: readonly Error[] = [
      new AgentTerminalRestartException("s1"),
      new CommandExitedException("git", new ProcessExit(1, null)),
      new DefaultShellNotFoundException(),
      new EnvironmentExportInvalidException(),
      new FolderNotFoundException("/missing"),
      new HostEndedException(),
      new ShellKindNotFoundException([TerminalShellKind.Bash]),
      new WslDistributionsUnreadableException(),
      new StaleTerminalException("t1"),
      new StoredLinesDamagedException(),
      new StoredLinesUnwritableException(new Error("Disk full.")),
      new UnknownMethodException("terminal.nothing"),
      new UnsupportedSystemException(SystemRequirement.Glibc, "2.27")
    ];

    assert.deepEqual(errors.filter(t => !(t instanceof TerminalException)).map(t => t.name), []);
  });
});
