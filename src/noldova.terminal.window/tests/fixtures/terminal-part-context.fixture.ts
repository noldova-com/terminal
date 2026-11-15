/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonValue } from "@noldova/context.json";
import { QualifiedName, SettingEntry } from "@noldova/desktop.protocol";
import { UnansweredCallException } from "@noldova/desktop.protocol/testing";
import type { CommandContribution, ISelectionSource, IViewInstanceOptions, IViewUpdate, IWindowPartContext, ViewContribution } from "@noldova/desktop.window";
import { FakeWindowPartContext } from "@noldova/desktop.window/testing";
import type { LinkGesture } from "@noldova/ui.components.angular";

type MenuProvider = Parameters<IWindowPartContext["provideMenuGroup"]>[1];
type OptionsProvider = Parameters<IWindowPartContext["provideSettingOptions"]>[1];

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

export class TerminalPartContext extends FakeWindowPartContext {
  private static readonly defaults: ReadonlyMap<string, JsonValue> = new Map<string, JsonValue>([
    ["terminal.defaultShell", ""],
    ["terminal.outputLimit", 100],
    ["terminal.fontSize", 13],
    ["terminal.suggestions", true],
    ["terminal.commandColors", false],
    ["terminal.completionList", true]
  ]);

  public readonly views: ViewContribution[] = [];
  public readonly commands: CommandContribution[] = [];
  public readonly opened: OpenedTab[] = [];
  public readonly closed: string[] = [];
  public readonly shownViews: string[] = [];
  public readonly hiddenDocks: string[] = [];
  public readonly grownDocks: [string, number][] = [];
  public readonly releasedDocks: string[] = [];
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
  public linkFailure: Error | null = null;
  public moduleId: string | null = null;

  public override readonly registerSelectionSource: IWindowPartContext["registerSelectionSource"] = (element, source) => {
    this.selectionSources.set(element, source);
    const release: () => void = this.track("registerSelectionSource", [element, source]);
    return () => {
      release();
      if (this.selectionSources.get(element) === source)
        this.selectionSources.delete(element);
    };
  };

  public override readonly provideMenuGroup: IWindowPartContext["provideMenuGroup"] = (group, provider) => {
    this.menuGroups.set(group, provider);
    const release: () => void = this.track("provideMenuGroup", [group, provider]);
    return () => {
      release();
      this.menuGroups.delete(group);
    };
  };

  public override readonly provideSettingOptions: IWindowPartContext["provideSettingOptions"] = (setting, provider) => {
    this.settingOptions.set(setting, provider);
    const release: () => void = this.track("provideSettingOptions", [setting, provider]);
    return () => {
      release();
      this.settingOptions.delete(setting);
    };
  };

  public override readonly growViewDock: IWindowPartContext["growViewDock"] = (name, minimum, instance) => {
    this.requireOwn(name);
    const tab: string = TerminalPartContext.tabOf(name, instance);
    this.grownDocks.push([tab, minimum]);
    const release: () => void = this.track("growViewDock", [name, minimum, instance]);
    return () => {
      release();
      this.releasedDocks.push(tab);
    };
  };

  public constructor() {
    super();
    this.answer("registerView", view => void this.views.push(view));
    this.answer("registerCommand", command => void this.commands.push(command));
    this.answer("openView", (name, instance, title, options) => {
      this.requireOwn(name);
      this.opened.push(new OpenedTab(name, instance, title, options));
    });
    this.answer("closeView", (name, instance) => {
      this.requireOwn(name);
      this.closed.push(instance);
    });
    this.answer("showView", name => {
      this.requireOwn(name);
      this.shownViews.push(name);
    });
    this.answer("hideViewDock", (name, instance) => {
      this.requireOwn(name);
      this.hiddenDocks.push(TerminalPartContext.tabOf(name, instance));
    });
    this.answer("updateView", (name, instance, update) => {
      this.requireOwn(name);
      this.updates.push([instance, update]);
    });
    this.answer("refreshSettingOptions", setting => void this.refreshedSettings.push(setting));
    this.answer("log", message => void this.logs.push(message));
    this.answer("findWindowCommand", () => null);
    this.answer("readSetting", name => this.settings.get(name));
    this.answer("readSettingAsync", async name => {
      await Promise.resolve();
      return this.entryOf(name);
    });
    this.answer("openLinkAsync", async (url, options) => {
      this.links.push(url);
      this.linkGestures.push(options?.gesture);
      if (this.linkFailure !== null)
        throw this.linkFailure;
    });
    this.answer("requestAsync", async (method, parameters) => {
      this.requests.push(new SentRequest(method, parameters));
      const handlerAsync: ((parameters: JsonValue) => Promise<JsonValue>) | undefined = this.handlers.get(method);
      if (handlerAsync === undefined)
        throw new UnansweredCallException(`requestAsync(${method})`);
      return handlerAsync(parameters);
    });
  }

  public entryOf(name: string): SettingEntry {
    const value: JsonValue | undefined = this.settings.get(name);
    return new SettingEntry(QualifiedName.parse(name), value ?? TerminalPartContext.defaultOf(name), value !== undefined);
  }

  public changeSetting(name: string, value: JsonValue | undefined): void {
    if (value === undefined)
      this.settings.delete(name);
    else
      this.settings.set(name, value);
    this.raiseSettingChanged(name, value ?? TerminalPartContext.defaultOf(name), null, value !== undefined);
  }

  public closeTab(name: string, instance: string): void {
    this.raiseViewClosed(name, instance);
  }

  public renameTab(name: string, instance: string, title: string): void {
    this.raiseTabRenamed(name, instance, title);
  }

  public emit(event: string, payload: JsonValue): void {
    this.raiseEvent(event, payload);
  }

  public listenerCount(event: string): number {
    return this.activeCallsOf("onEvent").filter(t => t[0] === event).length;
  }

  public sent(method: string): readonly JsonValue[] {
    return this.requests.filter(t => t.method === method).map(t => t.parameters);
  }

  private requireOwn(name: string): void {
    if (this.moduleId !== null && !name.startsWith(`${this.moduleId}.`))
      throw new Error(`TerminalPartContext's own guard for Noldova Desktop's ForeignNameException: the module ${this.moduleId} may contribute only names of its own, not ${name}.`);
  }

  private static tabOf(name: string, instance: string | undefined): string {
    return instance === undefined ? name : `${name}/${instance}`;
  }

  private static defaultOf(name: string): JsonValue {
    const value: JsonValue | undefined = TerminalPartContext.defaults.get(name);
    if (value === undefined)
      throw new UnansweredCallException(`the default of the setting ${name}`);
    return value;
  }
}
