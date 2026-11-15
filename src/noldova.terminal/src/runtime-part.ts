/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { homedir, release, tmpdir } from "node:os";

import type { IRuntimePart, IRuntimePartContext, Migration } from "@noldova/desktop.runtime";
import { TerminalNames } from "@noldova/terminal.protocol";

import { UnsupportedSystemException } from "./exceptions/unsupported-system.exception.ts";
import type { IEnvironmentSource } from "./interfaces/i-environment-source.ts";
import type { IFolderAccess } from "./interfaces/i-folder-access.ts";
import { EnvironmentTools } from "./models/environment-tools.ts";
import { RequestClient } from "./models/request-client.ts";
import type { SystemShortfall } from "./models/system-shortfall.ts";
import { TerminalEvents } from "./models/terminal-events.ts";
import { Resources } from "./resources.ts";
import { AgentTerminals } from "./services/agent-terminals.ts";
import { CommandRunner } from "./services/command-runner.ts";
import { CompletionSource } from "./services/completion-source.ts";
import { ContextPtySpawner } from "./services/context-pty-spawner.ts";
import { FileSystemWriter } from "./services/file-system-writer.ts";
import { FileSystemReader } from "./services/file-system.reader.ts";
import { FolderAccess } from "./services/folder-access.ts";
import { LineProcessStarter } from "./services/line-process-starter.ts";
import { MacEnvironment } from "./services/mac-environment.ts";
import { ProcessSignaller } from "./services/process-signaller.ts";
import { SavedTerminals } from "./services/saved-terminals.ts";
import { ShellEnvironment } from "./services/shell-environment.ts";
import { ShellIntegration } from "./services/shell-integration.ts";
import { ShellLocator } from "./services/shell-locator.ts";
import { SystemRequirements } from "./services/system-requirements.ts";
import { TerminalHistoryFolder } from "./services/terminal-history-folder.ts";
import { TerminalHost } from "./services/terminal-host.ts";
import { TerminalOwnerService } from "./services/terminal-owner.service.ts";
import { TerminalTools } from "./tools/services/terminal-tools.ts";

export class RuntimePart implements IRuntimePart {
  public readonly migrations: readonly Migration[] = SavedTerminals.migrations;
  private host: TerminalHost | null = null;
  private tools: TerminalTools | null = null;
  private environment: IEnvironmentSource | null = null;

  public async activateAsync(context: IRuntimePartContext): Promise<void> {
    const shortfall: SystemShortfall | null = SystemRequirements.findShortfall(process.platform, release(), process.report.getReport());
    if (shortfall !== null) {
      const error: UnsupportedSystemException = new UnsupportedSystemException(shortfall.requirement, shortfall.found);
      context.log.write(error.message);
      throw error;
    }
    const reader: FileSystemReader = new FileSystemReader();
    const writer: FileSystemWriter = new FileSystemWriter();
    const runner: CommandRunner = new CommandRunner(context);
    const access: IFolderAccess | null = FolderAccess.create(process.platform, runner, process.env);
    const environment: IEnvironmentSource = ShellEnvironment.create(process.platform, process.env,
      new EnvironmentTools(new LineProcessStarter(context), runner, reader, writer, access, tmpdir()), context.log, Intl.DateTimeFormat().resolvedOptions().locale,
      MacEnvironment.hasSystemLocaleAsync);
    environment.start();
    try {
      const events: TerminalEvents = new TerminalEvents(
        context.declareEvent(TerminalNames.outputEvent),
        context.declareEvent(TerminalNames.exitedEvent),
        context.declareEvent(TerminalNames.restartedEvent),
        context.declareEvent(TerminalNames.titleChangedEvent),
        context.declareEvent(TerminalNames.cwdChangedEvent),
        context.declareEvent(TerminalNames.detachedEvent),
        context.declareEvent(TerminalNames.closedEvent),
        context.declareEvent(TerminalNames.openedEvent),
        context.declareEvent(TerminalNames.launchCommandEndedEvent),
        context.declareEvent(TerminalNames.runOpenedEvent),
        context.declareEvent(TerminalNames.runEndedEvent),
        context.declareEvent(TerminalNames.renamedEvent),
        context.declareEvent(TerminalNames.commandAddedEvent));
      const host: TerminalHost = new TerminalHost(
        new ContextPtySpawner(context),
        reader,
        new ShellIntegration(writer, tmpdir(), context.log, access, context.settings),
        new TerminalHistoryFolder(writer, reader, new ProcessSignaller(), tmpdir(), process.pid, context.log, access),
        new ShellLocator(process.platform, process.arch, process.env, ShellLocator.readUserShell(), reader, runner, context.log),
        process.platform,
        release(),
        environment,
        homedir(),
        context.log,
        events,
        new SavedTerminals(context.database, context.log),
        new CompletionSource(reader, runner, process.platform, homedir()));
      for (const name of TerminalNames.methods)
        context.registerMethod(name, { handleAsync: t => host.handleAsync(name, t.payload, RequestClient.fromContext(t)) });
      context.onClientClosed(t => host.closeConnectionAsync(t.connection, t.window));
      context.publishService(Resources.ownersService, new TerminalOwnerService(host));
      const tools: TerminalTools = new TerminalTools(new AgentTerminals(host, writer, await context.getWorkFolderAsync(), context.log));
      tools.publish(context.tools, context.log);
      this.host = host;
      this.tools = tools;
      this.environment = environment;
    }
    catch (error: unknown) {
      environment.end();
      throw error;
    }
  }

  public async deactivateAsync(): Promise<void> {
    const host: TerminalHost | null = this.host;
    const environment: IEnvironmentSource | null = this.environment;
    this.tools?.dispose();
    this.tools = null;
    this.host = null;
    this.environment = null;
    try {
      await host?.endAllAsync();
    }
    finally {
      environment?.end();
    }
  }
}
