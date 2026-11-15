/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Type } from "@angular/core";
import { ArgumentException } from "@noldova/context.exceptions";
import type { JsonValue } from "@noldova/context.json";
import { CommandContribution, ContentPadding, DockSide, ViewContribution, type IWindowPart, type IWindowPartContext } from "@noldova/desktop.window";
import { TerminalName, TerminalNames, TerminalReference, TerminalRunEnded, TerminalSummary } from "@noldova/terminal.protocol";

import { Resources } from "../../resources.ts";
import { TerminalNewArguments } from "../models/terminal-new-arguments.ts";
import { TerminalTabKey } from "../models/terminal-tab-key.ts";
import { TerminalConnection } from "./terminal-connection.ts";
import { TerminalFocus } from "./terminal-focus.ts";
import { TerminalLaunchEnds } from "./terminal-launch-ends.ts";
import { TerminalOwners } from "./terminal-owners.ts";
import { TerminalPart } from "./terminal-part.ts";
import { TerminalRestartTargets } from "./terminal-restart-targets.ts";
import { TerminalRunEnds } from "./terminal-run-ends.ts";
import { TerminalRunNotices } from "./terminal-run-notices.ts";
import { TerminalRuntimeClient } from "./terminal-runtime-client.ts";
import { TerminalShellMenu } from "./terminal-shell-menu.ts";

export class TerminalWindowPart implements IWindowPart {
  private rejoinAsync: (() => Promise<void>) | null = null;
  private stopServing: () => void = () => undefined;
  private activation: number = 0;

  public readonly moduleId: string = Resources.moduleId;
  public readonly padding: ContentPadding = ContentPadding.None;

  public async activateAsync(context: IWindowPartContext): Promise<void> {
    const client: TerminalRuntimeClient = new TerminalRuntimeClient(context);
    const activation: number = ++this.activation;
    const serving: Promise<void> = TerminalWindowPart.startWindowAsync(context, client).then(() => {
      if (this.activation === activation)
        this.stopServing = TerminalPart.serve(context);
    });
    const shells: TerminalShellMenu = new TerminalShellMenu(context);
    this.rejoinAsync = async () => {
      await TerminalWindowPart.showOwnerAsync(context, client);
      await TerminalWindowPart.restoreAsync(context, client);
      await client.nameTabsAsync();
    };
    context.registerView(new ViewContribution(Resources.panelView, Resources.panelTitle, Resources.panelIcon, DockSide.Bottom, false,
      () => TerminalWindowPart.loadPanelAsync(), ContentPadding.None));
    context.registerView(new ViewContribution(Resources.sessionView, Resources.panelTitle, Resources.panelIcon, DockSide.Bottom, false,
      () => TerminalWindowPart.loadSessionAsync(), ContentPadding.None, { hasInstances: true, tabRowPlace: Resources.tabRowPlace, isRenamable: true }));
    context.registerCommand(new CommandContribution(Resources.newCommand, Resources.newTitle, Resources.newIcon, Resources.newKey, async commandArguments => {
      await TerminalWindowPart.openNewAsync(context, client, shells, TerminalNewArguments.fromJson(commandArguments));
      return null;
    }));
    context.registerCommand(new CommandContribution(Resources.newWithShellCommand, Resources.newWithShellTitle, Resources.newIcon, null, async commandArguments => {
      const parsed: TerminalNewArguments = TerminalNewArguments.fromJson(commandArguments);
      if (parsed.shellId === null)
        throw new ArgumentException(Resources.shellIdRequired, Resources.shellIdArgument);
      await TerminalWindowPart.openNewAsync(context, client, shells, parsed);
      return null;
    }, t => TerminalNewArguments.fromJson(t).shellId !== null));
    context.registerCommand(new CommandContribution(Resources.toggleCommand, Resources.toggleTitle, Resources.toggleIcon, Resources.toggleKey, async () => {
      if (!await TerminalFocus.toggleAsync())
        await TerminalWindowPart.openNewAsync(context, client, shells, TerminalNewArguments.forNewOwner());
      return null;
    }));
    context.registerCommand(new CommandContribution(Resources.restartCommand, Resources.restartTitle, Resources.restartIcon, null, async commandArguments => {
      await TerminalRestartTargets.find(TerminalTabKey.fromArguments(commandArguments))?.restartAsync();
      return null;
    }, undefined, null, t => TerminalRestartTargets.find(TerminalTabKey.fromArguments(t))?.canRestart() ?? false));
    context.provideMenuGroup(Resources.shellListGroup, () => shells.listRows());
    context.provideSettingOptions(Resources.defaultShellSetting, () => shells.listOptions());
    void shells.loadAsync();
    context.onViewClosed(Resources.sessionView,
      t => void client.closeAsync(t).catch((error: unknown) => context.log(Resources.formatCloseFailed(error))));
    context.onEvent(TerminalNames.closedEvent, t => {
      try {
        context.closeView(Resources.sessionView, TerminalReference.fromJson(t).sessionId);
      }
      catch (error) {
        context.log(Resources.formatClosedFailed(error));
      }
    });
    context.onEvent(TerminalNames.openedEvent,
      t => void TerminalWindowPart.openOwnedAsync(client, t).catch((error: unknown) => context.log(Resources.formatOwnedOpenFailed(error))));
    context.onEvent(TerminalNames.runOpenedEvent, t => TerminalRunNotices.notice(TerminalReference.fromJson(t).sessionId));
    context.onEvent(TerminalNames.runEndedEvent, t => TerminalRunEnds.end(TerminalRunEnded.fromJson(t)));
    context.onTabRenamed(Resources.sessionView,
      (sessionId, title) => void client.renameAsync(sessionId, title).catch((error: unknown) => context.log(Resources.formatRenameFailed(error))));
    context.onEvent(TerminalNames.renamedEvent,
      t => void client.retitleAsync(TerminalName.fromJson(t)).catch((error: unknown) => context.log(Resources.formatRetitleFailed(error))));
    await Promise.all([serving, TerminalWindowPart.reopenAsync(context, client)]);
  }

  public async reconnectAsync(): Promise<boolean> {
    TerminalLaunchEnds.detachAll();
    TerminalRunEnds.detachAll();
    await this.rejoinAsync?.();
    TerminalConnection.reattachAll();
    return true;
  }

  public async deactivateAsync(): Promise<void> {
    this.activation++;
    this.stopServing();
    TerminalLaunchEnds.detachAll();
    TerminalRunEnds.detachAll();
  }

  private static async openNewAsync(context: IWindowPartContext, client: TerminalRuntimeClient, shells: TerminalShellMenu, options: TerminalNewArguments): Promise<void> {
    const owner: string | null = options.takesNewOwner ? TerminalOwners.readNewOwner() : options.owner;
    let sessionId: string;
    try {
      sessionId = await client.openAsync(options.shellId, options.folder, false, owner);
    }
    catch (error) {
      if (options.shellId !== null) {
        context.log(Resources.formatShellOpenFailed(options.shellId, error));
        void shells.loadAsync();
      }
      throw error;
    }
    if (owner !== null && owner !== TerminalOwners.shown) {
      if (options.takesNewOwner)
        context.log(Resources.formatNewOwnerHidden(owner));
      return;
    }
    await client.openTabsAsync([sessionId], options.tabGroup, () => owner === null || owner === TerminalOwners.shown);
  }

  private static async openOwnedAsync(client: TerminalRuntimeClient, payload: JsonValue): Promise<void> {
    const summary: TerminalSummary = TerminalSummary.fromJson(payload);
    const owner: string | null = summary.owner;
    if (owner !== null && owner === TerminalOwners.shown && summary.opensTab)
      await client.openTabsAsync([summary.sessionId], null, () => owner === TerminalOwners.shown, false);
  }

  private static async reopenAsync(context: IWindowPartContext, client: TerminalRuntimeClient): Promise<void> {
    await TerminalWindowPart.restoreAsync(context, client);
    try {
      await client.openTabsAsync(await client.listTabTerminalsAsync(TerminalOwners.shown));
    }
    catch (error) {
      context.log(Resources.formatReopenFailed(error));
    }
  }

  private static async startWindowAsync(context: IWindowPartContext, client: TerminalRuntimeClient): Promise<void> {
    try {
      await client.startWindowAsync();
    }
    catch (error) {
      context.log(Resources.formatWindowStartFailed(error));
    }
    await TerminalWindowPart.showOwnerAsync(context, client);
  }

  private static async showOwnerAsync(context: IWindowPartContext, client: TerminalRuntimeClient): Promise<void> {
    try {
      await client.showOwnerAsync(TerminalOwners.shown);
    }
    catch (error) {
      context.log(Resources.formatShowOwnerFailed(error));
    }
  }

  private static async restoreAsync(context: IWindowPartContext, client: TerminalRuntimeClient): Promise<void> {
    try {
      await client.restoreAsync();
    }
    catch (error) {
      context.log(Resources.formatRestoreFailed(error));
    }
  }

  private static async loadPanelAsync(): Promise<Type<unknown>> {
    return (await import("../components/terminal-panel/terminal-panel.component.ts")).TerminalPanelComponent;
  }

  private static async loadSessionAsync(): Promise<Type<unknown>> {
    return (await import("../components/terminal-session/terminal-session.component.ts")).TerminalSessionComponent;
  }
}
