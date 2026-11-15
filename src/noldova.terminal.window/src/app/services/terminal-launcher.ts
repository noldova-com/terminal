/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { JsonException } from "@noldova/context.json";
import type { IWindowPartContext } from "@noldova/desktop.window";
import { ArgumentValidator, type ArgumentProblem, Resources as ProtocolResources, TerminalCommandEnded, TerminalExited, TerminalNames, TerminalShellKind, type TerminalLaunched } from "@noldova/terminal.protocol";

import { Resources } from "../../resources.ts";
import { LaunchArgumentRefusedException } from "../exceptions/launch-argument-refused.exception.ts";
import { LaunchFolderMissingException } from "../exceptions/launch-folder-missing.exception.ts";
import { LaunchPartInactiveException } from "../exceptions/launch-part-inactive.exception.ts";
import { LaunchRowsRefusedException } from "../exceptions/launch-rows-refused.exception.ts";
import { LaunchRowsWithoutTabException } from "../exceptions/launch-rows-without-tab.exception.ts";
import { LaunchTitleRefusedException } from "../exceptions/launch-title-refused.exception.ts";
import { LaunchedTerminal } from "../models/launched-terminal.ts";
import { TerminalEnd } from "../models/terminal-end.ts";
import type { TerminalLaunch } from "../models/terminal-launch.ts";
import { TerminalDockGrowths } from "./terminal-dock-growths.ts";
import { TerminalLaunchEnds } from "./terminal-launch-ends.ts";
import { TerminalPart } from "./terminal-part.ts";
import { TerminalRuntimeClient } from "./terminal-runtime-client.ts";

export class TerminalLauncher {
  public static async openAsync(context: IWindowPartContext, request: TerminalLaunch): Promise<LaunchedTerminal> {
    const part: IWindowPartContext = TerminalLauncher.check(request);
    const client: TerminalRuntimeClient = new TerminalRuntimeClient(context);
    const early: Map<string, TerminalEnd> = new Map<string, TerminalEnd>();
    let onEnd: (sessionId: string, end: TerminalEnd) => void = (sessionId, end) => {
      early.set(sessionId, end);
    };
    const stopListening: () => void = context.onEvent(TerminalNames.exitedEvent, t => {
      let exited: TerminalExited;
      try {
        exited = TerminalExited.fromJson(t);
      }
      catch (error) {
        if (!(error instanceof JsonException))
          throw error;
        context.log(Resources.formatEventUnread(TerminalNames.exitedEvent, error));
        return;
      }
      onEnd(exited.sessionId, new TerminalEnd(exited.exit.endedBy, exited.exit.exitCode));
    });
    const earlyCommands: Map<string, number | null> = new Map<string, number | null>();
    let onCommandEnd: (sessionId: string, exitCode: number | null) => void = (sessionId, exitCode) => {
      earlyCommands.set(sessionId, exitCode);
    };
    const stopCommands: () => void = request.command === null ? () => undefined : context.onEvent(TerminalNames.launchCommandEndedEvent, t => {
      let ended: TerminalCommandEnded;
      try {
        ended = TerminalCommandEnded.fromJson(t);
      }
      catch (error) {
        if (!(error instanceof JsonException))
          throw error;
        context.log(Resources.formatEventUnread(TerminalNames.launchCommandEndedEvent, error));
        return;
      }
      onCommandEnd(ended.sessionId, ended.exitCode);
    });
    let launched: TerminalLaunched;
    try {
      launched = await client.launchAsync(request.folder, request.environment, request.notice, request.command, request.opensTab, request.shellKinds);
    }
    catch (error) {
      stopListening();
      stopCommands();
      throw error;
    }
    const sessionId: string | null = launched.sessionId;
    if (sessionId === null) {
      stopListening();
      stopCommands();
      throw new LaunchFolderMissingException(String(launched.missingFolder));
    }
    const ended: Promise<TerminalEnd> = new Promise<TerminalEnd>(resolve => {
      const finish: (end: TerminalEnd) => void = end => {
        stopListening();
        TerminalLaunchEnds.remove(sessionId);
        resolve(end);
      };
      TerminalLaunchEnds.add(sessionId, finish);
      onEnd = (id, end) => {
        if (id === sessionId)
          finish(end);
      };
      const end: TerminalEnd | undefined = early.get(sessionId);
      if (end !== undefined)
        finish(end);
    });
    const commandEnded: Promise<number | null> = new Promise<number | null>(resolve => {
      const finish: (exitCode: number | null) => void = exitCode => {
        stopCommands();
        resolve(exitCode);
      };
      onCommandEnd = (id, exitCode) => {
        if (id === sessionId)
          finish(exitCode);
      };
      void ended.then(() => finish(null));
      const exitCode: number | null | undefined = request.command === null ? null : earlyCommands.get(sessionId);
      if (exitCode !== undefined)
        finish(exitCode);
    });
    if (request.minimumRows !== null)
      void ended.then(TerminalDockGrowths.ask(sessionId, request.minimumRows));
    if (request.opensTab)
      await new TerminalRuntimeClient(part).openTabsAsync([sessionId], null, () => TerminalPart.context === part, true, request.title);
    return new LaunchedTerminal(sessionId, ended, () => TerminalLauncher.closeAsync(client, sessionId, request.opensTab), commandEnded);
  }

  private static async closeAsync(client: TerminalRuntimeClient, sessionId: string, hasTab: boolean): Promise<void> {
    if (hasTab)
      TerminalPart.context?.closeView(Resources.sessionView, sessionId);
    try {
      await client.closeAsync(sessionId);
    }
    catch (error) {
      if ((await client.listAsync()).some(t => t.sessionId === sessionId))
        throw error;
    }
  }

  private static check(request: TerminalLaunch): IWindowPartContext {
    const part: IWindowPartContext | null = TerminalPart.context;
    if (part === null)
      throw new LaunchPartInactiveException();
    if (request.title !== null && (request.title.trim() === "" || request.title.length > Resources.maximumTitleLength))
      throw new LaunchTitleRefusedException(Resources.maximumTitleLength);
    const rows: number | null = request.minimumRows;
    if (rows !== null && !(Number.isInteger(rows) && rows >= 1 && rows <= Resources.maximumMinimumRows))
      throw new LaunchRowsRefusedException(Resources.maximumMinimumRows);
    if (rows !== null && !request.opensTab)
      throw new LaunchRowsWithoutTabException();
    const problem: ArgumentProblem | null =
      (request.folder === null ? null : ArgumentValidator.findAbsolutePathProblem(Resources.folderArgument, request.folder))
      ?? ArgumentValidator.findEnvironmentProblem(Resources.environmentArgument, request.environment)
      ?? (request.notice === null ? null : ArgumentValidator.findNonBlankProblem(Resources.noticeArgument, request.notice, ProtocolResources.maximumNoticeLength))
      ?? (request.command === null ? null : ArgumentValidator.findCommandProblem(Resources.commandArgument, request.command))
      ?? ArgumentValidator.findEachOneOfProblem(Resources.shellKindsArgument, request.shellKinds, Object.values(TerminalShellKind));
    if (problem !== null)
      throw new LaunchArgumentRefusedException(problem.parameterName, problem.reason);
    return part;
  }
}
