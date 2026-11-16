/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { signal, type Signal, type WritableSignal } from "@angular/core";
import { QualifiedName, SettingEntry } from "@noldova/desktop.protocol";
import type { CommandContribution, DockSide, ILinkOpenOptions, ISelectionSource, IViewInstanceOptions, IViewUpdate, IWindowPartContext, ViewContribution } from "@noldova/desktop.window";
import type { LinkGesture } from "@noldova/ui.components.angular";
import type { JsonValue } from "@noldova/context.json";

import declaration from "../../../noldova.terminal/settings.json" with { type: "json" };

type MenuProvider = Parameters<IWindowPartContext["provideMenuGroup"]>[1];
type OptionsProvider = Parameters<IWindowPartContext["provideSettingOptions"]>[1];
type SettingListener = Parameters<IWindowPartContext["onSettingChanged"]>[1];

export class SentRequest {
  public readonly method: string;
  public readonly parameters: JsonValue;

  public constructor(method: string, parameters: JsonValue) {
    this.method = method;
    this.parameters = parameters;
  }
}

export class OpenedTab {
  public readonly name: string;
  public readonly instance: string;
  public readonly title: string;
  public readonly options: IViewInstanceOptions | undefined;

  public constructor(name: string, instance: string, title: string, options?: IViewInstanceOptions) {
    this.name = name;
    this.instance = instance;
    this.title = title;
    this.options = options;
  }
}

export class FakeWindowPartContext implements IWindowPartContext {
  public readonly views: ViewContribution[] = [];
  public readonly commands: CommandContribution[] = [];
  public readonly opened: OpenedTab[] = [];
  public readonly closed: string[] = [];
  public readonly shownViews: string[] = [];
  public readonly hiddenDocks: string[] = [];
  public readonly grownDocks: [string, number][] = [];
  public readonly releasedDocks: string[] = [];
  public readonly dock: WritableSignal<DockSide | null> = signal<DockSide | null>(null);
  public readonly updates: [string, IViewUpdate][] = [];
  public readonly logs: string[] = [];
  public readonly links: string[] = [];
  public readonly linkGestures: (LinkGesture | undefined)[] = [];
  public readonly requests: SentRequest[] = [];
  public readonly handlers: Map<string, (parameters: JsonValue) => Promise<JsonValue>> = new Map();
  public readonly settings: Map<string, JsonValue> = new Map();
  public readonly menuGroups: Map<string, MenuProvider> = new Map();
  public readonly settingOptions: Map<string, OptionsProvider> = new Map();
  public readonly refreshedSettings: string[] = [];
  public readonly selectionSources: Map<HTMLElement, ISelectionSource> = new Map();
  public linkAnswerAsync: () => Promise<void> = async () => undefined;
  public moduleId: string | null = null;
  public settingAnswerAsync: () => Promise<void> = async () => undefined;
  public readonly registerPlaceholder: IWindowPartContext["registerPlaceholder"] = FakeWindowPartContext.unused;
  public readonly registerStatusBarItem: IWindowPartContext["registerStatusBarItem"] = FakeWindowPartContext.unused;
  public readonly registerTopBarAction: IWindowPartContext["registerTopBarAction"] = FakeWindowPartContext.unused;
  public readonly registerSave: IWindowPartContext["registerSave"] = FakeWindowPartContext.unused;
  public readonly setViewBadge: IWindowPartContext["setViewBadge"] = FakeWindowPartContext.unused;
  public readonly fileAddressOf: IWindowPartContext["fileAddressOf"] = FakeWindowPartContext.unused;
  public readonly markWorking: IWindowPartContext["markWorking"] = FakeWindowPartContext.unused;
  public readonly markWaiting: IWindowPartContext["markWaiting"] = FakeWindowPartContext.unused;
  public readonly registerDocument: IWindowPartContext["registerDocument"] = FakeWindowPartContext.unused;
  public readonly registerSettingsPage: IWindowPartContext["registerSettingsPage"] = FakeWindowPartContext.unused;
  public readonly setSettingsRows: IWindowPartContext["setSettingsRows"] = FakeWindowPartContext.unused;
  public readonly registerSearchSource: IWindowPartContext["registerSearchSource"] = FakeWindowPartContext.unused;
  public readonly openDocument: IWindowPartContext["openDocument"] = FakeWindowPartContext.unused;
  public readonly onDependencyChanged: IWindowPartContext["onDependencyChanged"] = FakeWindowPartContext.unused;
  public readonly isDependencyActive: IWindowPartContext["isDependencyActive"] = FakeWindowPartContext.unused;
  public readonly provideSettingCheck: IWindowPartContext["provideSettingCheck"] = FakeWindowPartContext.unused;
  public readonly updateDocument: IWindowPartContext["updateDocument"] = FakeWindowPartContext.unused;
  public readonly forgetDocument: IWindowPartContext["forgetDocument"] = FakeWindowPartContext.unused;
  public readonly isAllowed: IWindowPartContext["isAllowed"] = FakeWindowPartContext.unused;
  public readonly runCommandAsync: IWindowPartContext["runCommandAsync"] = FakeWindowPartContext.unused;
  public findWindowCommand: IWindowPartContext["findWindowCommand"] = () => null;
  public readonly postNotificationAsync: IWindowPartContext["postNotificationAsync"] = FakeWindowPartContext.unused;
  public readonly keepDocument: IWindowPartContext["keepDocument"] = FakeWindowPartContext.unused;
  public readonly closeDocument: IWindowPartContext["closeDocument"] = FakeWindowPartContext.unused;
  public readonly showInDialogAsync: IWindowPartContext["showInDialogAsync"] = FakeWindowPartContext.unused;
  public readonly openBelowWindowRowAsync: IWindowPartContext["openBelowWindowRowAsync"] = FakeWindowPartContext.unused;
  public readonly chooseFolderAsync: IWindowPartContext["chooseFolderAsync"] = FakeWindowPartContext.unused;
  public readonly openFileAsync: IWindowPartContext["openFileAsync"] = FakeWindowPartContext.unused;
  public readonly saveFileAsync: IWindowPartContext["saveFileAsync"] = FakeWindowPartContext.unused;
  public readonly showInFolderAsync: IWindowPartContext["showInFolderAsync"] = FakeWindowPartContext.unused;
  public readonly writeSettingAsync: IWindowPartContext["writeSettingAsync"] = FakeWindowPartContext.unused;
  public readonly resetSettingAsync: IWindowPartContext["resetSettingAsync"] = FakeWindowPartContext.unused;
  public readonly chooseFilesAsync: IWindowPartContext["chooseFilesAsync"] = FakeWindowPartContext.unused;
  public readonly grantFilesAsync: IWindowPartContext["grantFilesAsync"] = FakeWindowPartContext.unused;
  public readonly discardFileGrants: IWindowPartContext["discardFileGrants"] = FakeWindowPartContext.unused;
  public readonly chooseFilePathAsync: IWindowPartContext["chooseFilePathAsync"] = FakeWindowPartContext.unused;
  public readonly keyOf: IWindowPartContext["keyOf"] = FakeWindowPartContext.unused;
  public readonly onDocumentClosed: IWindowPartContext["onDocumentClosed"] = FakeWindowPartContext.unused;
  public readonly listOpenDocumentsAsync: IWindowPartContext["listOpenDocumentsAsync"] = FakeWindowPartContext.unused;
  public readonly showLinkMenu: IWindowPartContext["showLinkMenu"] = FakeWindowPartContext.unused;
  public readonly registerInAppBrowser: IWindowPartContext["registerInAppBrowser"] = FakeWindowPartContext.unused;
  private readonly listeners: Map<string, Set<(payload: JsonValue) => void>> = new Map();
  private readonly closeListeners: Map<string, Set<(instance: string) => void>> = new Map();
  private readonly settingListeners: Map<string, Set<SettingListener>> = new Map();
  private readonly renameListeners: Map<string, Set<(instance: string, title: string) => void>> = new Map();

  public get webViews(): IWindowPartContext["webViews"] {
    return FakeWindowPartContext.unused();
  }

  public get agentControl(): IWindowPartContext["agentControl"] {
    return FakeWindowPartContext.unused();
  }

  public get secrets(): IWindowPartContext["secrets"] {
    return FakeWindowPartContext.unused();
  }

  public registerView(view: ViewContribution): void {
    this.views.push(view);
  }

  public registerCommand(command: CommandContribution): void {
    this.commands.push(command);
  }

  public registerSelectionSource(element: HTMLElement, source: ISelectionSource): () => void {
    this.selectionSources.set(element, source);
    return () => {
      if (this.selectionSources.get(element) === source)
        this.selectionSources.delete(element);
    };
  }

  public openView(name: string, instance: string, title: string, options?: IViewInstanceOptions): void {
    this.requireOwn(name);
    this.opened.push(new OpenedTab(name, instance, title, options));
  }

  public closeView(name: string, instance: string): void {
    this.requireOwn(name);
    this.closed.push(instance);
  }

  public showView(name: string): void {
    this.requireOwn(name);
    this.shownViews.push(name);
  }

  public hideViewDock(name: string, instance?: string): void {
    this.requireOwn(name);
    this.hiddenDocks.push(instance === undefined ? name : `${name}/${instance}`);
  }

  public growViewDock(name: string, minimum: number, instance?: string): () => void {
    this.requireOwn(name);
    const tab: string = instance === undefined ? name : `${name}/${instance}`;
    this.grownDocks.push([tab, minimum]);
    return () => this.releasedDocks.push(tab);
  }

  public viewDockOf(name: string): Signal<DockSide | null> {
    this.requireOwn(name);
    return this.dock.asReadonly();
  }

  public provideMenuGroup(group: string, provider: MenuProvider): () => void {
    this.menuGroups.set(group, provider);
    return () => this.menuGroups.delete(group);
  }

  public provideSettingOptions(setting: string, provider: OptionsProvider): () => void {
    this.settingOptions.set(setting, provider);
    return () => this.settingOptions.delete(setting);
  }

  public refreshSettingOptions(setting: string): void {
    this.refreshedSettings.push(setting);
  }

  public readSetting(name: string): JsonValue | undefined {
    return this.settings.get(name);
  }

  public async readSettingAsync(name: string): Promise<SettingEntry> {
    await Promise.resolve();
    await this.settingAnswerAsync();
    const value: JsonValue | undefined = this.settings.get(name);
    return new SettingEntry(QualifiedName.parse(name), value ?? FakeWindowPartContext.defaultOf(name), value !== undefined);
  }

  public onSettingChanged(name: string, listener: SettingListener): () => void {
    const listeners: Set<SettingListener> = this.settingListeners.get(name) ?? new Set();
    listeners.add(listener);
    this.settingListeners.set(name, listeners);
    return () => listeners.delete(listener);
  }

  public changeSetting(name: string, value: JsonValue | undefined): void {
    if (value === undefined)
      this.settings.delete(name);
    else
      this.settings.set(name, value);
    for (const listener of [...this.settingListeners.get(name) ?? []])
      listener(value ?? FakeWindowPartContext.defaultOf(name), null, value !== undefined);
  }

  public updateView(name: string, instance: string, update: IViewUpdate): void {
    this.requireOwn(name);
    this.updates.push([instance, update]);
  }

  public onViewClosed(name: string, listener: (instance: string) => void): () => void {
    const listeners: Set<(instance: string) => void> = this.closeListeners.get(name) ?? new Set();
    listeners.add(listener);
    this.closeListeners.set(name, listeners);
    return () => listeners.delete(listener);
  }

  public closeTab(name: string, instance: string): void {
    for (const listener of [...this.closeListeners.get(name) ?? []])
      listener(instance);
  }

  public onTabRenamed(name: string, listener: (instance: string, title: string) => void): () => void {
    const listeners: Set<(instance: string, title: string) => void> = this.renameListeners.get(name) ?? new Set();
    listeners.add(listener);
    this.renameListeners.set(name, listeners);
    return () => listeners.delete(listener);
  }

  public renameTab(name: string, instance: string, title: string): void {
    for (const listener of [...this.renameListeners.get(name) ?? []])
      listener(instance, title);
  }

  public log(message: string): void {
    this.logs.push(message);
  }

  public async openLinkAsync(url: string, options?: ILinkOpenOptions): Promise<void> {
    this.links.push(url);
    this.linkGestures.push(options?.gesture);
    await this.linkAnswerAsync();
  }

  public async requestAsync(method: string, parameters: JsonValue): Promise<JsonValue> {
    this.requests.push(new SentRequest(method, parameters));
    const handlerAsync: ((parameters: JsonValue) => Promise<JsonValue>) | undefined = this.handlers.get(method);
    return handlerAsync === undefined ? null : handlerAsync(parameters);
  }

  public onEvent(event: string, listener: (payload: JsonValue) => void): () => void {
    const listeners: Set<(payload: JsonValue) => void> = this.listeners.get(event) ?? new Set();
    listeners.add(listener);
    this.listeners.set(event, listeners);
    return () => listeners.delete(listener);
  }

  public emit(event: string, payload: JsonValue): void {
    for (const listener of [...this.listeners.get(event) ?? []])
      listener(payload);
  }

  public listenerCount(event: string): number {
    return this.listeners.get(event)?.size ?? 0;
  }

  public sent(method: string): readonly JsonValue[] {
    return this.requests.filter(t => t.method === method).map(t => t.parameters);
  }

  private requireOwn(name: string): void {
    if (this.moduleId !== null && !name.startsWith(`${this.moduleId}.`))
      throw new Error(`The module ${this.moduleId} may contribute only names of its own, not ${name}.`);
  }

  private static defaultOf(name: string): JsonValue {
    return declaration.settings.find(t => t.name === name)?.default ?? null;
  }

  private static unused(): never {
    throw new Error("The terminal's window part doesn't use this member of its context.");
  }
}
