/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Exception, ExceptionOptions } from "@noldova/context.exceptions";
import { TerminalRunOutcome, TerminalShellKind } from "@noldova/terminal.protocol";
import { describe, expect, it } from "vitest";

import { EmbeddedRowsRefusedException } from "../../../src/app/exceptions/embedded-rows-refused.exception.ts";
import { LaunchArgumentRefusedException } from "../../../src/app/exceptions/launch-argument-refused.exception.ts";
import { LaunchFolderMissingException } from "../../../src/app/exceptions/launch-folder-missing.exception.ts";
import { LaunchPartInactiveException } from "../../../src/app/exceptions/launch-part-inactive.exception.ts";
import { LaunchRowsRefusedException } from "../../../src/app/exceptions/launch-rows-refused.exception.ts";
import { LaunchRowsWithoutTabException } from "../../../src/app/exceptions/launch-rows-without-tab.exception.ts";
import { LaunchTitleRefusedException } from "../../../src/app/exceptions/launch-title-refused.exception.ts";
import { OwnersProvidedException } from "../../../src/app/exceptions/owners-provided.exception.ts";
import { RunArgumentRefusedException } from "../../../src/app/exceptions/run-argument-refused.exception.ts";
import { RunLinesRefusedException } from "../../../src/app/exceptions/run-lines-refused.exception.ts";
import { RunPartInactiveException } from "../../../src/app/exceptions/run-part-inactive.exception.ts";
import { RunShellKindsMissingException } from "../../../src/app/exceptions/run-shell-kinds-missing.exception.ts";
import { StartFolderProvidedException } from "../../../src/app/exceptions/start-folder-provided.exception.ts";
import { TerminalNotActiveException } from "../../../src/app/exceptions/terminal-not-active.exception.ts";
import { TerminalRunNotFoundException } from "../../../src/app/exceptions/terminal-run-not-found.exception.ts";
import { TerminalRunNotTypedException } from "../../../src/app/exceptions/terminal-run-not-typed.exception.ts";
import { TerminalWindowException } from "../../../src/app/exceptions/terminal-window.exception.ts";

describe("TerminalWindowException", () => {
  it("carries its name and message, as a context Exception", () => {
    const error: TerminalWindowException = new TerminalWindowException("The window failed.");

    expect(error).toBeInstanceOf(Exception);
    expect([error.name, error.message, error.cause]).toEqual(["TerminalWindowException", "The window failed.", undefined]);
  });

  it("keeps the cause it is given through ExceptionOptions", () => {
    const cause: Error = new Error("The runtime closed.");

    const error: TerminalWindowException = new TerminalWindowException("The window failed.", new ExceptionOptions(cause));

    expect([error.message, error.cause]).toEqual(["The window failed.", cause]);
  });

  it("is the base of every exception the window part owns", () => {
    const errors: readonly Error[] = [
      new EmbeddedRowsRefusedException(0, 1, 1000),
      new LaunchArgumentRefusedException("folder", "Expected an absolute path."),
      new LaunchFolderMissingException("/gone"),
      new LaunchPartInactiveException(),
      new LaunchRowsRefusedException(100),
      new LaunchRowsWithoutTabException(),
      new LaunchTitleRefusedException(200),
      new OwnersProvidedException(),
      new RunArgumentRefusedException("command", "Expected a string that is not blank."),
      new RunLinesRefusedException(0, 10000),
      new RunPartInactiveException(),
      new RunShellKindsMissingException([TerminalShellKind.Bash]),
      new StartFolderProvidedException(),
      new TerminalNotActiveException(),
      new TerminalRunNotFoundException("s1", "r1"),
      new TerminalRunNotTypedException("s1", TerminalRunOutcome.Tab)
    ];

    expect(errors.filter(t => !(t instanceof TerminalWindowException)).map(t => t.name)).toEqual([]);
  });
});
