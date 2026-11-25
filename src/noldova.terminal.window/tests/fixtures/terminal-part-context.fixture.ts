/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import { signal, type WritableSignal } from "@angular/core";
import type { JsonValue } from "@noldova/context.json";
import { QualifiedName, SettingEntry } from "@noldova/desktop.protocol";
import { UnansweredCallException } from "@noldova/desktop.protocol/testing";
import { LinkPlace, type CommandContribution, type DockSide, type IInAppBrowser, type ISelectionSource, type IViewInstanceOptions, type IWindowPartContext, type ViewContribution } from "@noldova/desktop.window";
import { FakeWindowPartContext } from "@noldova/desktop.window/testing";
import { LinkGesture } from "@noldova/ui.components.angular";
import { GrownDock } from "./grown-dock.fixture.ts";
import { UpdatedView } from "./updated-view.fixture.ts";

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
    ["terminal.completionList", true],
    ["terminal.linkClick", "System"]
  ]);

  public readonly views: ViewContribution[] = [];
  public readonly commands: CommandContribution[] = [];
  public readonly opened: OpenedTab[] = [];
  public readonly closed: string[] = [];
  public readonly shownViews: string[] = [];
  public readonly hiddenDocks: string[] = [];
  public readonly grownDocks: GrownDock[] = [];
  public readonly releasedDocks: string[] = [];
  public readonly dock: WritableSignal<DockSide | null> = signal<DockSide | null>(null);
  public readonly updates: UpdatedView[] = [];
  public readonly logs: string[] = [];
  public readonly links: string[] = [];
  public readonly linkGestures: (LinkGesture | undefined)[] = [];
  public readonly linkPlaces: LinkPlace[] = [];
  public readonly requests: SentRequest[] = [];
  public readonly handlers: Map<string, (parameters: JsonValue) => Promise<JsonValue>> = new Map();
  public readonly settings: Map<string, JsonValue> = new Map();
  public readonly menuGroups: Map<string, MenuProvider> = new Map();
  public readonly settingOptions: Map<string, OptionsProvider> = new Map();
  public readonly refreshedSettings: string[] = [];
  public readonly selectionSources: Map<HTMLElement, ISelectionSource> = new Map();
  public linkFailure: Error | null = null;
  public inAppBrowser: IInAppBrowser | null = null;
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
    this.grownDocks.push(new GrownDock(tab, minimum));
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
    this.answer("viewDockOf", name => {
      this.requireOwn(name);
      return this.dock.asReadonly();
    });
    this.answer("updateView", (name, instance, update) => {
      this.requireOwn(name);
      this.updates.push(new UpdatedView(instance, update));
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
      this.linkPlaces.push(options?.place ?? this.inAppBrowser?.placeFor(url, options?.gesture ?? LinkGesture.Plain) ?? LinkPlace.System);
      if (!Object.isNull(this.linkFailure))
        throw this.linkFailure;
    });
    this.answer("requestAsync", async (method, parameters) => {
      this.requests.push(new SentRequest(method, parameters));
      const handlerAsync: ((parameters: JsonValue) => Promise<JsonValue>) | undefined = this.handlers.get(method);
      if (Object.isUndefined(handlerAsync))
        throw new UnansweredCallException(`requestAsync(${method})`);
      return handlerAsync(parameters);
    });
  }

  public entryOf(name: string): SettingEntry {
    const value: JsonValue | undefined = this.settings.get(name);
    return new SettingEntry(QualifiedName.parse(name), value ?? TerminalPartContext.defaultOf(name), !Object.isUndefined(value));
  }

  public changeSetting(name: string, value: JsonValue | undefined): void {
    if (Object.isUndefined(value))
      this.settings.delete(name);
    else
      this.settings.set(name, value);
    this.raiseSettingChanged(name, value ?? TerminalPartContext.defaultOf(name), null, !Object.isUndefined(value));
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
    if (!Object.isNull(this.moduleId) && !name.startsWith(`${this.moduleId}.`))
      throw new Error(`TerminalPartContext's own guard for Noldova Desktop's ForeignNameException: the module ${this.moduleId} may contribute only names of its own, not ${name}.`);
  }

  private static tabOf(name: string, instance: string | undefined): string {
    return Object.isUndefined(instance) ? name : `${name}/${instance}`;
  }

  private static defaultOf(name: string): JsonValue {
    const value: JsonValue | undefined = TerminalPartContext.defaults.get(name);
    if (Object.isUndefined(value))
      throw new UnansweredCallException(`the default of the setting ${name}`);
    return value;
  }
}
