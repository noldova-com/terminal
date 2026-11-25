/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import { JsonException, type JsonValue } from "@noldova/context.json";
import { FailureCode } from "@noldova/desktop.protocol";
import type { IWindowPartContext } from "@noldova/desktop.window";
import { Resources as ProtocolResources, TerminalLaunched, TerminalLaunchParams, TerminalName, TerminalNames, TerminalOpenParams, TerminalReference, TerminalRestartParams, TerminalRestoreParams, TerminalRunOutput, TerminalRunOutputParams, TerminalRunParams, TerminalRunResult, TerminalSessions, TerminalShowOwnerParams,
  type TerminalShellKind, TerminalSize, type TerminalSummary } from "@noldova/terminal.protocol";

import { Resources } from "../../resources.ts";
import type { TerminalRunTarget } from "../models/terminal-run-target.ts";
import { TerminalTabLabel } from "../models/terminal-tab-label.ts";
import { TerminalFocus } from "./terminal-focus.ts";
import { TerminalRestartTargets } from "./terminal-restart-targets.ts";
import { TerminalStartFolder } from "./terminal-start-folder.ts";

export class TerminalRuntimeClient {
  private static readonly unnamedByWindow: WeakMap<IWindowPartContext, Set<string>> = new WeakMap<IWindowPartContext, Set<string>>();
  private static readonly launchTitlesByWindow: WeakMap<IWindowPartContext, Map<string, string>> = new WeakMap<IWindowPartContext, Map<string, string>>();
  private readonly context: IWindowPartContext;
  private readonly unnamed: Set<string>;
  private readonly launchTitles: Map<string, string>;
  private readonly retitles: Map<string, number> = new Map<string, number>();

  public constructor(context: IWindowPartContext) {
    this.context = context;
    let unnamed: Set<string> | undefined = TerminalRuntimeClient.unnamedByWindow.get(context);
    if (Object.isUndefined(unnamed)) {
      unnamed = new Set<string>();
      TerminalRuntimeClient.unnamedByWindow.set(context, unnamed);
    }
    this.unnamed = unnamed;
    let launchTitles: Map<string, string> | undefined = TerminalRuntimeClient.launchTitlesByWindow.get(context);
    if (Object.isUndefined(launchTitles)) {
      launchTitles = new Map<string, string>();
      TerminalRuntimeClient.launchTitlesByWindow.set(context, launchTitles);
    }
    this.launchTitles = launchTitles;
  }

  public async openAsync(shellId: string | null, folder: string | null, isPanelTerminal: boolean = false, owner: string | null = null): Promise<string> {
    const chosen: string | null = shellId ?? this.readDefaultShell();
    try {
      return await this.openWithAsync(chosen, folder, isPanelTerminal, owner);
    }
    catch (error) {
      if (!Object.isNull(shellId) || Object.isNull(chosen) || !TerminalRuntimeClient.isNotFound(error))
        throw error;
      this.context.log(Resources.formatDefaultShellFailed(chosen, error));
      return this.openWithAsync(null, folder, isPanelTerminal, owner);
    }
  }

  public async launchAsync(folder: string | null, environment: Readonly<Record<string, string>>, notice: string | null,
    command: string | null = null, opensTab: boolean = true, shellKinds: readonly TerminalShellKind[] = []): Promise<TerminalLaunched> {
    const chosen: string | null = this.readDefaultShell();
    try {
      return await this.launchWithAsync(chosen, folder, environment, notice, command, opensTab, shellKinds);
    }
    catch (error) {
      if (Object.isNull(chosen) || shellKinds.length > 0 || !TerminalRuntimeClient.isNotFound(error))
        throw error;
      this.context.log(Resources.formatDefaultShellFailed(chosen, error));
      return this.launchWithAsync(null, folder, environment, notice, command, opensTab, shellKinds);
    }
  }

  public async runAsync(owner: string, command: string, folder: string | null, shellKinds: readonly TerminalShellKind[],
    target: TerminalRunTarget | null = null, opensTab: boolean = true): Promise<TerminalRunResult> {
    const params: TerminalRunParams = new TerminalRunParams(owner, command, folder ?? TerminalStartFolder.read(), shellKinds, this.readDefaultShell(),
      new TerminalSize(Resources.openingColumns, Resources.openingRows), this.readStoredLimit(), target?.sessionId ?? null, target?.whenBusy, opensTab);
    return TerminalRunResult.fromJson(await this.context.requestAsync(TerminalNames.runMethod, params.toJson()));
  }

  public async readRunOutputAsync(sessionId: string, runId: string, maximumLines: number): Promise<TerminalRunOutput | null> {
    const output: JsonValue = await this.context.requestAsync(TerminalNames.runOutputMethod,
      new TerminalRunOutputParams(sessionId, runId, maximumLines).toJson());
    return Object.isNull(output) ? null : TerminalRunOutput.fromJson(output);
  }

  public async restartAsync(sessionId: string, size: TerminalSize, isPanelTerminal: boolean = false): Promise<string> {
    if (!(await this.listAsync()).some(t => t.sessionId === sessionId))
      return this.openAsync(null, null, isPanelTerminal);
    await this.context.requestAsync(TerminalNames.restartMethod, new TerminalRestartParams(sessionId, size).toJson());
    return sessionId;
  }

  public async closeAsync(sessionId: string): Promise<void> {
    this.unnamed.delete(sessionId);
    this.launchTitles.delete(sessionId);
    this.retitles.delete(sessionId);
    const terminal: TerminalSummary | undefined = (await this.listAsync()).find(t => t.sessionId === sessionId);
    if (Object.isUndefined(terminal) || terminal.isAgentTerminal && Object.isNull(terminal.owner))
      return;
    await this.context.requestAsync(TerminalNames.closeMethod, new TerminalReference(sessionId).toJson());
  }

  public async startWindowAsync(): Promise<void> {
    await this.context.requestAsync(TerminalNames.windowStartedMethod, null);
  }

  public async showOwnerAsync(owner: string | null): Promise<void> {
    const isHidden: boolean = document.visibilityState === Resources.hiddenVisibility;
    await this.context.requestAsync(TerminalNames.showOwnerMethod, new TerminalShowOwnerParams(isHidden ? null : owner, isHidden).toJson());
  }

  public async restoreAsync(): Promise<void> {
    const params: TerminalRestoreParams = new TerminalRestoreParams(new TerminalSize(Resources.openingColumns, Resources.openingRows),
      this.readDefaultShell(), this.readStoredLimit());
    await this.context.requestAsync(TerminalNames.restoreMethod, params.toJson());
  }

  public async openTabsAsync(sessionIds: readonly string[], tabGroup: string | null = null, isWanted: () => boolean = () => true,
    isAsked: boolean = true, title: string | null = null): Promise<void> {
    if (sessionIds.length === 0)
      return;
    const closed: Set<string> = new Set<string>();
    const stopListening: () => void = this.context.onEvent(TerminalNames.closedEvent, t => {
      try {
        closed.add(TerminalReference.fromJson(t).sessionId);
      }
      catch (error) {
        if (!(error instanceof JsonException))
          throw error;
      }
    });
    const labels: ReadonlyMap<string, TerminalTabLabel> | null = await this.listLabelsAsync().catch((error: unknown) => {
      this.context.log(Resources.formatTabShellsFailed(error));
      return null;
    });
    stopListening();
    for (const sessionId of sessionIds) {
      if (!isWanted() || closed.has(sessionId))
        continue;
      const label: TerminalTabLabel | undefined = labels?.get(sessionId);
      if (!Object.isNull(title))
        this.launchTitles.set(sessionId, title);
      const launchTitle: string | null = this.launchTitles.get(sessionId) ?? null;
      if (!isAsked && !TerminalRestartTargets.has(Resources.sessionView, sessionId))
        TerminalFocus.openUnasked(sessionId);
      this.context.openView(Resources.sessionView, sessionId, label?.name ?? launchTitle ?? label?.shellName ?? Resources.panelTitle,
        { ...this.iconOf(label), ...(Object.isNull(tabGroup) ? {} : { tabGroup }) });
      if (Object.isNull(labels) && Object.isNull(launchTitle))
        this.unnamed.add(sessionId);
    }
    if (!Object.isNull(labels))
      this.nameTabs(labels);
  }

  public async nameTabsAsync(): Promise<void> {
    if (this.unnamed.size === 0)
      return;
    let labels: ReadonlyMap<string, TerminalTabLabel>;
    try {
      labels = await this.listLabelsAsync();
    }
    catch (error) {
      this.context.log(Resources.formatTabShellsFailed(error));
      return;
    }
    this.nameTabs(labels);
  }

  public async renameAsync(sessionId: string, text: string): Promise<void> {
    const name: string = TerminalRuntimeClient.cut(text.trim(), ProtocolResources.maximumTitleLength).trim();
    await this.context.requestAsync(TerminalNames.renameMethod, new TerminalName(sessionId, name === "" ? null : name).toJson());
  }

  public async retitleAsync(name: TerminalName): Promise<void> {
    const retitle: number = (this.retitles.get(name.sessionId) ?? 0) + 1;
    this.retitles.set(name.sessionId, retitle);
    const title: string | undefined = name.name ?? this.launchTitles.get(name.sessionId);
    if (!Object.isUndefined(title)) {
      this.context.updateView(Resources.sessionView, name.sessionId, { title });
      return;
    }
    let label: TerminalTabLabel | undefined;
    try {
      label = (await this.listLabelsAsync()).get(name.sessionId);
    }
    catch (error) {
      this.context.log(Resources.formatTabShellsFailed(error));
      this.unnamed.add(name.sessionId);
    }
    if (this.retitles.get(name.sessionId) !== retitle)
      return;
    this.context.updateView(Resources.sessionView, name.sessionId, {
      title: label?.name ?? this.launchTitles.get(name.sessionId) ?? label?.shellName ?? Resources.panelTitle,
      ...this.iconOf(label)
    });
  }

  public async listTabTerminalsAsync(shown: string | null): Promise<readonly string[]> {
    return (await this.listAsync()).filter(t => !t.isPanelTerminal && t.opensTab && (Object.isNull(t.owner) ? !t.isAgentTerminal : t.owner === shown))
      .map(t => t.sessionId);
  }

  public async isAgentTerminalAsync(sessionId: string): Promise<boolean> {
    return (await this.listAsync()).find(t => t.sessionId === sessionId)?.isAgentTerminal ?? false;
  }

  public async findPanelTerminalAsync(): Promise<string | null> {
    return (await this.listAsync()).findLast(t => t.isPanelTerminal)?.sessionId ?? null;
  }

  public async listAsync(): Promise<readonly TerminalSummary[]> {
    return TerminalSessions.fromJson(await this.context.requestAsync(TerminalNames.sessionsMethod, null)).sessions;
  }

  public static isNotFound(error: unknown): boolean {
    return error instanceof Error && "code" in error && error.code === FailureCode.NotFound;
  }

  public static isRefusal(error: unknown): boolean {
    return error instanceof Error && "code" in error && Object.isString(error.code);
  }

  private static cut(text: string, maximumLength: number): string {
    let cut: string = "";
    for (const character of text) {
      if (cut.length + character.length > maximumLength)
        break;
      cut += character;
    }
    return cut;
  }

  private async openWithAsync(shellId: string | null, folder: string | null, isPanelTerminal: boolean, owner: string | null): Promise<string> {
    const params: TerminalOpenParams = new TerminalOpenParams(shellId, folder ?? TerminalStartFolder.read(),
      new TerminalSize(Resources.openingColumns, Resources.openingRows), this.readStoredLimit(), isPanelTerminal, owner);
    return TerminalReference.fromJson(await this.context.requestAsync(TerminalNames.openMethod, params.toJson())).sessionId;
  }

  private async launchWithAsync(shellId: string | null, folder: string | null, environment: Readonly<Record<string, string>>,
    notice: string | null, command: string | null, opensTab: boolean, shellKinds: readonly TerminalShellKind[]): Promise<TerminalLaunched> {
    const params: TerminalLaunchParams = new TerminalLaunchParams(shellId, folder ?? TerminalStartFolder.read(),
      new TerminalSize(Resources.openingColumns, Resources.openingRows), this.readStoredLimit(), environment, notice, command, opensTab, shellKinds);
    return TerminalLaunched.fromJson(await this.context.requestAsync(TerminalNames.launchMethod, params.toJson()));
  }

  private readDefaultShell(): string | null {
    const chosen: JsonValue | undefined = this.context.readSetting(Resources.defaultShellSetting);
    return Object.isString(chosen) && chosen.trim() !== "" && chosen.length <= ProtocolResources.maximumIdentifierLength ? chosen : null;
  }

  private readStoredLimit(): number {
    const limit: JsonValue | undefined = this.context.readSetting(Resources.outputLimitSetting);
    const bytes: number = Object.isNumber(limit) && Number.isInteger(limit) ? limit * ProtocolResources.storedLimitUnit : Number.NaN;
    return bytes >= ProtocolResources.minimumStoredLimit && bytes <= ProtocolResources.maximumStoredLimit ? bytes : ProtocolResources.defaultStoredLimit;
  }

  private nameTabs(labels: ReadonlyMap<string, TerminalTabLabel>): void {
    for (const sessionId of this.unnamed) {
      const label: TerminalTabLabel | undefined = labels.get(sessionId);
      const title: string | null | undefined = label?.name ?? label?.shellName;
      if (!Object.isUndefined(title) && !Object.isNull(title))
        this.context.updateView(Resources.sessionView, sessionId, { title, ...this.iconOf(label) });
    }
    this.unnamed.clear();
  }

  private iconOf(label: TerminalTabLabel | undefined): { readonly icon: string } {
    return { icon: Object.isUndefined(label) || Object.isNull(label.shellName) ? Resources.panelIcon : Resources.shellKindIcons[label.shellKind] };
  }

  private async listLabelsAsync(): Promise<ReadonlyMap<string, TerminalTabLabel>> {
    return new Map((await this.listAsync()).map(t => [t.sessionId, new TerminalTabLabel(t.name, t.shellName, t.shellKind)] as const));
  }
}
