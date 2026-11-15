/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import * as api from "../../src/api/index.ts";
import { EmbeddedRowsRefusedException, EmbeddedTerminal, LaunchArgumentRefusedException, LaunchFolderMissingException, LaunchPartInactiveException, LaunchRowsRefusedException,
  LaunchRowsWithoutTabException, LaunchTitleRefusedException, RunArgumentRefusedException, RunLinesRefusedException, RunPartInactiveException, RunShellKindsMissingException,
  TerminalLaunchRefusedException, TerminalLine, TerminalNotActiveException, TerminalRun, TerminalRunBusy, TerminalRunEnd, TerminalRunNotFoundException, TerminalRunNotTypedException,
  TerminalRunOutcome, TerminalRunOutput, TerminalRunRefusedException, TerminalRunTarget, TerminalShellKind, TerminalTextRun, TerminalTextStyle, TerminalWindowException,
  windowPart } from "../../src/api/index.ts";
import { LaunchedTerminal as AppLaunchedTerminal } from "../../src/app/models/launched-terminal.ts";
import { TerminalEnd as AppTerminalEnd } from "../../src/app/models/terminal-end.ts";
import { TerminalLaunch as AppTerminalLaunch } from "../../src/app/models/terminal-launch.ts";
import { EmbeddedTerminal as AppEmbeddedTerminal } from "../../src/app/services/embedded-terminal.ts";
import { TerminalLauncher as AppTerminalLauncher } from "../../src/app/services/terminal-launcher.ts";
import { TerminalOwners as AppTerminalOwners } from "../../src/app/services/terminal-owners.ts";
import { TerminalStartFolder as AppTerminalStartFolder } from "../../src/app/services/terminal-start-folder.ts";
import { TerminalWindowPart } from "../../src/app/services/terminal-window-part.ts";

describe("api", () => {
  it("exports exactly the declared names", () => {
    expect(Object.keys(api).sort()).toEqual([
      "EmbeddedRowsRefusedException", "EmbeddedTerminal", "LaunchArgumentRefusedException", "LaunchFolderMissingException", "LaunchPartInactiveException",
      "LaunchRowsRefusedException", "LaunchRowsWithoutTabException", "LaunchTitleRefusedException", "LaunchedTerminal", "OwnersProvidedException",
      "RunArgumentRefusedException", "RunLinesRefusedException", "RunPartInactiveException", "RunShellKindsMissingException", "StartFolderProvidedException",
      "TerminalEnd", "TerminalLaunch", "TerminalLaunchRefusedException", "TerminalLauncher", "TerminalLine", "TerminalNotActiveException", "TerminalOwners",
      "TerminalRun", "TerminalRunBusy", "TerminalRunEnd", "TerminalRunNotFoundException", "TerminalRunNotTypedException", "TerminalRunOutcome", "TerminalRunOutput",
      "TerminalRunRefusedException", "TerminalRunTarget", "TerminalShellKind", "TerminalStartFolder", "TerminalTextRun", "TerminalTextStyle", "TerminalWindowException",
      "windowPart"
    ]);
    expect(Object.entries(api).filter(([, value]) => value === undefined)).toEqual([]);
  });

  it("exports the launcher, the owners and the start folder, with what a launch takes, gives and ends with, and what providing them twice fails with", () => {
    expect([api.TerminalLauncher, api.TerminalOwners, api.TerminalStartFolder, api.LaunchedTerminal, api.TerminalEnd, api.TerminalLaunch])
      .toEqual([AppTerminalLauncher, AppTerminalOwners, AppTerminalStartFolder, AppLaunchedTerminal, AppTerminalEnd, AppTerminalLaunch]);
    expect([new api.StartFolderProvidedException().name, new api.OwnersProvidedException().name]).toEqual(["StartFolderProvidedException", "OwnersProvidedException"]);
    expect([new api.StartFolderProvidedException(), new api.OwnersProvidedException()].every(t => t instanceof TerminalWindowException)).toBe(true);
  });

  it("exports the terminal module's window part as windowPart", () => {
    expect(windowPart).toBeInstanceOf(TerminalWindowPart);
    expect(windowPart.moduleId).toBe("terminal");
  });

  it("exports what a run takes and fails with: the shell kinds, the refusal, and the outcome of commands it didn't type", () => {
    expect([TerminalShellKind.Bash, new RunArgumentRefusedException("command", "no").name, new TerminalRunNotTypedException("s1", TerminalRunOutcome.Tab).reason])
      .toEqual(["Bash", "RunArgumentRefusedException", "Tab"]);
  });

  it("exports each refusal of a run under its base", () => {
    const refusals: readonly Error[] = [new RunPartInactiveException(), new RunArgumentRefusedException("owner", "no"), new RunShellKindsMissingException([TerminalShellKind.Bash])];

    expect(refusals.map(t => [t.name, t instanceof TerminalRunRefusedException])).toEqual([["RunPartInactiveException", true], ["RunArgumentRefusedException", true],
      ["RunShellKindsMissingException", true]]);
  });

  it("exports each refusal of a launch under its base", () => {
    const refusals: readonly Error[] = [new LaunchPartInactiveException(), new LaunchFolderMissingException("/gone"), new LaunchTitleRefusedException(200),
      new LaunchRowsRefusedException(100), new LaunchRowsWithoutTabException(), new LaunchArgumentRefusedException("folder", "no")];

    expect(refusals.map(t => [t.name, t instanceof TerminalLaunchRefusedException])).toEqual([["LaunchPartInactiveException", true],
      ["LaunchFolderMissingException", true], ["LaunchTitleRefusedException", true], ["LaunchRowsRefusedException", true], ["LaunchRowsWithoutTabException", true],
      ["LaunchArgumentRefusedException", true]]);
  });

  it("exports what reading a run's output and embedding a terminal refuse out-of-range numbers with", () => {
    expect([new RunLinesRefusedException(0, 10_000).name, new EmbeddedRowsRefusedException(0, 1, 1_000).name]).toEqual(["RunLinesRefusedException",
      "EmbeddedRowsRefusedException"]);
  });

  it("exports the embedded terminal and what it fails with while Terminal isn't active", () => {
    expect([EmbeddedTerminal, new TerminalNotActiveException().name]).toEqual([AppEmbeddedTerminal, "TerminalNotActiveException"]);
  });

  it("exports the base of the window part's exceptions", () => {
    expect(new TerminalNotActiveException()).toBeInstanceOf(TerminalWindowException);
  });

  it("exports a run into a given terminal, its output with the output's colors and styles, and what reading it fails with", () => {
    const output: TerminalRunOutput = new TerminalRunOutput([new TerminalLine("a", false, [new TerminalTextRun(1, -1, -1, TerminalTextStyle.Bold)])], 0);

    expect([new TerminalRunTarget("s1", TerminalRunBusy.Interrupt).whenBusy, new TerminalRun("s1", "r1").runId, new TerminalRunNotFoundException("s1", "r1").name,
      output.lines[0]?.runs[0]?.style, new TerminalRunEnd("Command", 0).endedBy]).toEqual(["Interrupt", "r1", "TerminalRunNotFoundException", TerminalTextStyle.Bold,
      "Command"]);
  });
});
