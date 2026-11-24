/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import type { CommandContribution, IWindowPartContext, MenuRowContribution } from "@noldova/desktop.window";
import { ArgumentException } from "@noldova/context.exceptions";
import { JsonException, type JsonValue } from "@noldova/context.json";
import { EndedBy, TerminalExit, TerminalName, TerminalNames, TerminalShellKind, TerminalSummary } from "@noldova/terminal.protocol";
import { afterEach, describe, expect, it, type MockInstance, vi } from "vitest";

import menus from "../../../../noldova.terminal/menus.json" with { type: "json" };

import { TerminalPanelComponent } from "../../../src/app/components/terminal-panel/terminal-panel.component.ts";
import { TerminalSessionComponent } from "../../../src/app/components/terminal-session/terminal-session.component.ts";
import { LaunchPartInactiveException } from "../../../src/app/exceptions/launch-part-inactive.exception.ts";
import type { ITerminalFocusTarget } from "../../../src/app/interfaces/i-terminal-focus-target.ts";
import type { ITerminalRestartTarget } from "../../../src/app/interfaces/i-terminal-restart-target.ts";
import type { LaunchedTerminal } from "../../../src/app/models/launched-terminal.ts";
import { TerminalEnd } from "../../../src/app/models/terminal-end.ts";
import { TerminalLaunch } from "../../../src/app/models/terminal-launch.ts";
import { TerminalConnection } from "../../../src/app/services/terminal-connection.ts";
import { TerminalFocus } from "../../../src/app/services/terminal-focus.ts";
import { TerminalLauncher } from "../../../src/app/services/terminal-launcher.ts";
import { TerminalOwners } from "../../../src/app/services/terminal-owners.ts";
import { TerminalPart } from "../../../src/app/services/terminal-part.ts";
import { TerminalRestartTargets } from "../../../src/app/services/terminal-restart-targets.ts";
import { TerminalRuntimeClient } from "../../../src/app/services/terminal-runtime-client.ts";
import { TerminalStartFolder } from "../../../src/app/services/terminal-start-folder.ts";
import { TerminalWindowPart } from "../../../src/app/services/terminal-window-part.ts";
import chatsMenus from "../../fixtures/chats-module/menus.json" with { type: "json" };
import chatsModule from "../../fixtures/chats-module/module.json" with { type: "json" };
import { FakeRuntime } from "../../fixtures/fake-runtime.fixture.ts";
import { HeldAnswer } from "../../fixtures/held-answer.fixture.ts";
import { SpecWait } from "../../fixtures/spec-wait.fixture.ts";

const PLUS_ROW = menus.groups[0]?.items?.[0];
const PLUS_ARGUMENTS: Readonly<Record<string, JsonValue>> | undefined = !Object.isUndefined(PLUS_ROW) && "arguments" in PLUS_ROW ? PLUS_ROW.arguments : undefined;

describe("TerminalWindowPart", () => {
  const parts: TerminalWindowPart[] = [];

  function createPart(): TerminalWindowPart {
    const part: TerminalWindowPart = new TerminalWindowPart();
    parts.push(part);
    return part;
  }

  afterEach(async () => {
    for (const part of parts.splice(0))
      await part.deactivateAsync();
    const served: IWindowPartContext | null = TerminalPart.context;
    if (!Object.isNull(served))
      TerminalPart.serve(served)();
  });

  function runRowAsync(runtime: FakeRuntime, row: MenuRowContribution | undefined, context: Readonly<Record<string, JsonValue>>): Promise<JsonValue> {
    return runtime.context.commands.find(t => t.name === row?.command)?.runAsync({ ...context, ...row?.commandArguments }) ?? Promise.resolve(null);
  }

  it("draws its views and tabs edge to edge", () => {
    const part: TerminalWindowPart = createPart();

    expect([part.moduleId, part.padding]).toEqual(["terminal", "None"]);
  });

  it("registers the bottom panel, the bottom session tabs with their tab row, renamable in place, and its commands with their keys, which load the pane only when they show", async () => {
    const runtime: FakeRuntime = new FakeRuntime();

    await createPart().activateAsync(runtime.context);

    expect(runtime.context.views.map(t => [t.name, t.title, t.icon, t.defaultSide, t.isShownByDefault, t.padding, t.hasInstances, t.tabRowPlace,
      t.isRenamable])).toEqual([
      ["terminal.panel", "Terminal", "terminal", "Bottom", false, "None", false, null, false],
      ["terminal.session", "Terminal", "terminal", "Bottom", false, "None", true, "terminal.tabRow", true]
    ]);
    expect(runtime.context.commands.map(t => [t.name, t.title, t.icon, t.defaultKey?.text ?? null])).toEqual([
      ["terminal.new", "New Terminal", "add", "Ctrl+Shift+Backquote"],
      ["terminal.newWithShell", "New Terminal with Shell", "add", null],
      ["terminal.toggle", "Toggle Terminal", "terminal", "Ctrl+Backquote"],
      ["terminal.restartShell", "Restart Terminal", "refresh", null]
    ]);
    expect(runtime.context.requests.map(t => t.method)).toEqual([TerminalNames.windowStartedMethod, TerminalNames.shellsMethod, TerminalNames.restoreMethod,
      TerminalNames.showOwnerMethod, TerminalNames.sessionsMethod]);
    expect(runtime.context.opened).toEqual([]);
    expect(await runtime.context.views[0]?.loadComponent()).toBe(TerminalPanelComponent);
    expect(await runtime.context.views[1]?.loadComponent()).toBe(TerminalSessionComponent);
  });

  it("reopens the tabs of the person's terminals the runtime still has, in the order they opened, but not the panel's, and ends none", async () => {
    const runtime: FakeRuntime = new FakeRuntime();
    runtime.addSession("s1", "bash", "/work");
    runtime.addSession("p1", "bash", "/work", null, false, true);
    runtime.addSession("a1", "bash", "/work", null, true);
    runtime.addSession("s2", "zsh", "/home/a", new TerminalExit(0, EndedBy.Exit));

    await createPart().activateAsync(runtime.context);

    expect(runtime.context.opened.map(t => [t.name, t.instance, t.title, t.options])).toEqual([
      ["terminal.session", "s1", "Bash", { icon: "attach_money" }],
      ["terminal.session", "s2", "Zsh", { icon: "percent" }]
    ]);
    expect(runtime.context.sent(TerminalNames.closeMethod)).toEqual([]);
  });

  it("reopens a plain Terminal tab for a terminal whose shell the runtime no longer lists", async () => {
    const runtime: FakeRuntime = new FakeRuntime();
    runtime.addSession("s1", "fish", "/work");
    runtime.addSession("s2", "zsh", "/work");

    await createPart().activateAsync(runtime.context);

    expect(runtime.context.opened.map(t => [t.instance, t.title, t.options])).toEqual([
      ["s1", "Terminal", { icon: "terminal" }],
      ["s2", "Zsh", { icon: "percent" }]
    ]);
    expect(runtime.context.logs).toEqual([]);
  });

  it("reopens plain Terminal tabs, and logs it, when the runtime can't list its terminals for their names", async () => {
    const runtime: FakeRuntime = new FakeRuntime();
    runtime.addSession("s1", "bash", "/work");
    runtime.sessionsFailure = new Error("The runtime is busy.");
    runtime.sessionsFailureFrom = 2;

    await createPart().activateAsync(runtime.context);

    expect(runtime.context.opened.map(t => [t.instance, t.title, t.options])).toEqual([["s1", "Terminal", { icon: "terminal" }]]);
    expect(runtime.context.logs).toContain("The terminal tabs show no shell names, since the terminals could not be listed: The runtime is busy.");
  });

  it("activates once the runtime lists its terminals, with no wait of its own, their tabs titled with their shells' names", async () => {
    const runtime: FakeRuntime = new FakeRuntime();
    runtime.addSession("s1", "zsh", "/work");
    const listing: HeldAnswer = runtime.holdListings();

    const activation: Promise<void> = createPart().activateAsync(runtime.context);
    await vi.waitFor(() => expect(runtime.listingCount).toBe(1), { timeout: SpecWait.milliseconds });
    expect(runtime.context.opened).toEqual([]);
    listing.resolve(null);
    await activation;

    expect(runtime.context.opened.map(t => [t.instance, t.title, t.options])).toEqual([["s1", "Zsh", { icon: "percent" }]]);
    expect(runtime.context.updates).toEqual([]);
  });

  it("has the runtime open again the terminals the last run left open, at the opening size, and reopens their tabs but the panel's", async () => {
    const runtime: FakeRuntime = new FakeRuntime();
    runtime.addSession("s1", "bash", "/work");
    runtime.saved.push(
      new TerminalSummary("r1", "bash", "/work/src", "", null, false, false, null, true, null, null, TerminalShellKind.Other),
      new TerminalSummary("r2", "bash", "/work", "", null, false, true, null, true, null, null, TerminalShellKind.Other),
      new TerminalSummary("r3", "zsh", "/home/a", "", null, false, false, null, true, null, null, TerminalShellKind.Other));

    await createPart().activateAsync(runtime.context);

    expect(runtime.context.sent(TerminalNames.restoreMethod)).toEqual([{ size: { cols: 80, rows: 24 }, shellId: null, storedLimit: 104_857_600 }]);
    expect(runtime.context.opened.map(t => t.instance)).toEqual(["s1", "r1", "r3"]);
    expect(runtime.context.logs).toEqual([]);
  });

  it("has the runtime end the terminals the window launched without a tab before it reloaded, before an app can launch through it", async () => {
    const runtime: FakeRuntime = new FakeRuntime();
    const answer: HeldAnswer = new HeldAnswer();
    runtime.context.handlers.set(TerminalNames.windowStartedMethod, async () => {
      await answer.promise;
      return null;
    });

    const activating: Promise<void> = createPart().activateAsync(runtime.context);
    await vi.waitFor(() => expect(runtime.context.sent(TerminalNames.sessionsMethod)).toHaveLength(1), { timeout: SpecWait.milliseconds });
    const before: readonly unknown[] = [TerminalPart.context, runtime.context.views.length, runtime.context.commands.length,
      runtime.context.sent(TerminalNames.windowStartedMethod)];
    answer.resolve(null);
    await activating;

    expect(before).toEqual([null, 2, 4, [null]]);
    expect(TerminalPart.context).toBe(runtime.context);
  });

  it("serves no launch when it deactivates before the runtime answers its window's start", async () => {
    const runtime: FakeRuntime = new FakeRuntime();
    const answer: HeldAnswer = new HeldAnswer();
    runtime.context.handlers.set(TerminalNames.windowStartedMethod, async () => {
      await answer.promise;
      return null;
    });
    const part: TerminalWindowPart = createPart();

    const activating: Promise<void> = part.activateAsync(runtime.context);
    await vi.waitFor(() => expect(runtime.context.sent(TerminalNames.windowStartedMethod)).toEqual([null]), { timeout: SpecWait.milliseconds });
    await part.deactivateAsync();
    answer.resolve(null);
    await activating;

    expect(TerminalPart.context).toBeNull();
  });

  it("tells the runtime the owner the window shows as it starts, once the runtime answers the window's start, and again as the runtime reconnects", async () => {
    const runtime: FakeRuntime = new FakeRuntime();
    const answer: HeldAnswer = new HeldAnswer();
    runtime.context.handlers.set(TerminalNames.windowStartedMethod, async () => {
      await answer.promise;
      return null;
    });
    const owners: TerminalOwners = TerminalOwners.provide(runtime.context, () => null);
    try {
      await owners.showAsync("example.chat/42");
      runtime.context.requests.splice(0);
      const part: TerminalWindowPart = createPart();

      const activating: Promise<void> = part.activateAsync(runtime.context);
      await vi.waitFor(() => expect(runtime.context.sent(TerminalNames.sessionsMethod)).toHaveLength(1), { timeout: SpecWait.milliseconds });
      const before: readonly JsonValue[] = runtime.context.sent(TerminalNames.showOwnerMethod);
      answer.resolve(null);
      await activating;
      const started: readonly JsonValue[] = runtime.context.sent(TerminalNames.showOwnerMethod);
      await part.reconnectAsync();

      expect([before, started, runtime.context.sent(TerminalNames.showOwnerMethod)]).toEqual([[], [{ owner: "example.chat/42", isHidden: false }],
        [{ owner: "example.chat/42", isHidden: false }, { owner: "example.chat/42", isHidden: false }]]);
    }
    finally {
      await owners.removeAsync();
    }
  });

  it("tells the runtime the window shows no owner as it starts when no app shows one", async () => {
    const runtime: FakeRuntime = new FakeRuntime();

    await createPart().activateAsync(runtime.context);

    expect(runtime.context.sent(TerminalNames.showOwnerMethod)).toEqual([{ owner: null, isHidden: false }]);
  });

  it("tells the runtime the window shows no owner as it starts while the window is hidden, though an app shows one", async () => {
    const runtime: FakeRuntime = new FakeRuntime();
    const owners: TerminalOwners = TerminalOwners.provide(runtime.context, () => null);
    const visibility: MockInstance<() => DocumentVisibilityState> = vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    try {
      await owners.showAsync("example.chat/42");
      runtime.context.requests.splice(0);

      await createPart().activateAsync(runtime.context);

      expect([TerminalOwners.shown, runtime.context.sent(TerminalNames.showOwnerMethod)]).toEqual(["example.chat/42", [{ owner: null, isHidden: true }]]);
    }
    finally {
      visibility.mockRestore();
      await owners.removeAsync();
    }
  });

  it("logs a shown owner the runtime can't be told of as the window starts, and still activates", async () => {
    const runtime: FakeRuntime = new FakeRuntime();
    runtime.context.handlers.set(TerminalNames.showOwnerMethod, () => Promise.reject(new Error("The runtime is gone.")));

    await createPart().activateAsync(runtime.context);

    expect(runtime.context.logs).toEqual(["The runtime could not be told which owner's terminals this window shows: The runtime is gone."]);
    expect(TerminalPart.context).toBe(runtime.context);
  });

  it("logs a window start the runtime fails, and still activates", async () => {
    const runtime: FakeRuntime = new FakeRuntime();
    runtime.context.handlers.set(TerminalNames.windowStartedMethod, () => Promise.reject(new Error("The runtime is gone.")));

    await createPart().activateAsync(runtime.context);

    expect(runtime.context.logs).toEqual(["The terminals this window launched without a tab before it reloaded could not be ended: The runtime is gone."]);
    expect(TerminalPart.context).toBe(runtime.context);
  });

  it("logs terminals the runtime could not open again, and still reopens the tabs of those it has", async () => {
    const runtime: FakeRuntime = new FakeRuntime();
    runtime.addSession("s1", "bash", "/work");
    runtime.context.handlers.set(TerminalNames.restoreMethod, () => Promise.reject(new Error("The database is locked.")));

    await createPart().activateAsync(runtime.context);

    expect(runtime.context.logs).toEqual(["The terminals the last run left open could not be opened again: The database is locked."]);
    expect(runtime.context.opened.map(t => t.instance)).toEqual(["s1"]);
  });

  it("logs terminal tabs it could not reopen, and still activates", async () => {
    const runtime: FakeRuntime = new FakeRuntime();
    runtime.context.handlers.set(TerminalNames.sessionsMethod, () => Promise.reject(new Error("The runtime is gone.")));

    await createPart().activateAsync(runtime.context);

    expect(runtime.context.logs).toEqual([
      "The terminal tabs could not be reopened, so their shells keep running without a tab: The runtime is gone."
    ]);
    expect(runtime.context.commands).toHaveLength(4);
  });

  it("ends a terminal's shell when the person closes its tab, and not the panel's, which runs beside it", async () => {
    const runtime: FakeRuntime = new FakeRuntime();
    runtime.addSession("p1", "bash", "/work", null, false, true);
    await createPart().activateAsync(runtime.context);
    await runtime.context.commands[0]?.runAsync(null);

    runtime.context.closeTab("terminal.session", "opened-1");

    await vi.waitFor(() => expect(runtime.context.sent(TerminalNames.closeMethod)).toEqual([{ sessionId: "opened-1" }]), { timeout: SpecWait.milliseconds });
    expect(runtime.context.opened.map(t => t.instance)).toEqual(["opened-1"]);
  });

  it("sends no close for a tab whose terminal the runtime has already forgotten", async () => {
    const runtime: FakeRuntime = new FakeRuntime();
    await createPart().activateAsync(runtime.context);

    runtime.context.closeTab("terminal.session", "gone");

    await vi.waitFor(() => expect(runtime.context.sent(TerminalNames.sessionsMethod)).toHaveLength(2), { timeout: SpecWait.milliseconds });
    await Promise.resolve();
    expect([runtime.context.sent(TerminalNames.closeMethod), runtime.context.logs]).toEqual([[], []]);
  });

  it("leaves an agent's terminal running when the person closes its tab", async () => {
    const runtime: FakeRuntime = new FakeRuntime();
    runtime.addSession("a1", "bash", "/work", null, true);
    await createPart().activateAsync(runtime.context);

    runtime.context.closeTab("terminal.session", "a1");

    await vi.waitFor(() => expect(runtime.context.sent(TerminalNames.sessionsMethod)).toHaveLength(2), { timeout: SpecWait.milliseconds });
    await Promise.resolve();
    expect(runtime.context.sent(TerminalNames.closeMethod)).toEqual([]);
  });

  it("logs a shell it could not end when the person closed its tab", async () => {
    const runtime: FakeRuntime = new FakeRuntime();
    runtime.context.handlers.set(TerminalNames.closeMethod, () => Promise.reject(new Error("No terminal s9.")));
    await createPart().activateAsync(runtime.context);
    runtime.addSession("s9", "bash", "/work");

    runtime.context.closeTab("terminal.session", "s9");

    await vi.waitFor(() => expect(runtime.context.logs).toEqual(["The terminal's shell could not be ended when its tab closed: No terminal s9."]),
      { timeout: SpecWait.milliseconds });
  });

  it("shows a terminal from Toggle Terminal, and opens a new one in its own tab when none can show", async () => {
    const runtime: FakeRuntime = new FakeRuntime();
    await createPart().activateAsync(runtime.context);
    const toggle: CommandContribution | undefined = runtime.context.commands.find(t => t.name === "terminal.toggle");
    let canShow: boolean = true;
    const target: ITerminalFocusTarget = { contains: () => false, isFor: () => false, showAsync: async () => canShow, hideDock: () => undefined };
    const remove: () => void = TerminalFocus.add(target);

    try {
      expect(await toggle?.runAsync(null)).toBeNull();
      expect(runtime.context.opened).toEqual([]);
      canShow = false;
      expect(await toggle?.runAsync(null)).toBeNull();
    }
    finally {
      remove();
    }

    expect(runtime.context.opened.map(t => [t.name, t.instance, t.title])).toEqual([["terminal.session", "opened-1", "Bash"]]);
  });

  it("opens a new terminal in its own tab, in the group Noldova Desktop chooses", async () => {
    const runtime: FakeRuntime = new FakeRuntime();
    await createPart().activateAsync(runtime.context);

    expect(await runtime.context.commands[0]?.runAsync(null)).toBeNull();

    expect(runtime.context.sent(TerminalNames.openMethod)).toHaveLength(1);
    expect(runtime.context.opened.map(t => [t.name, t.instance, t.title, t.options])).toEqual([["terminal.session", "opened-1", "Bash", { icon: "attach_money" }]]);
  });

  it("opens a new terminal in the group whose tab row asks for it, with the shell its shell menu row gives", async () => {
    const runtime: FakeRuntime = new FakeRuntime();
    await createPart().activateAsync(runtime.context);
    await vi.waitFor(() => expect(runtime.context.refreshedSettings).toEqual(["terminal.defaultShell"]), { timeout: SpecWait.milliseconds });
    const rows: readonly MenuRowContribution[] = runtime.context.menuGroups.get("terminal.shellList")?.({ tabGroup: "g2" }) ?? [];

    await runRowAsync(runtime, rows[1], { tabGroup: "g2" });
    await runtime.context.commands[0]?.runAsync({ tabGroup: null });

    expect(rows.map(t => t.label)).toEqual(["Bash (default)", "Zsh"]);
    expect(runtime.context.sent(TerminalNames.openMethod).map(t => (t as { shellId: string | null }).shellId)).toEqual(["zsh", null]);
    expect(runtime.context.opened.map(t => [t.instance, t.title, t.options])).toEqual([
      ["opened-1", "Zsh", { icon: "percent", tabGroup: "g2" }],
      ["opened-2", "Bash", { icon: "attach_money" }]
    ]);
  });

  it("shows New Terminal's key only on the default shell's row, which follows the Default shell setting", async () => {
    const runtime: FakeRuntime = new FakeRuntime();
    await createPart().activateAsync(runtime.context);
    await vi.waitFor(() => expect(runtime.context.refreshedSettings).toEqual(["terminal.defaultShell"]), { timeout: SpecWait.milliseconds });
    const keys: () => (readonly [string | null, string | null])[] = () => (runtime.context.menuGroups.get("terminal.shellList")?.({}) ?? [])
      .map(t => [t.label, runtime.context.commands.find(u => u.name === t.command)?.defaultKey?.label("win32") ?? null] as const);

    const systemDefault: (readonly [string | null, string | null])[] = keys();
    runtime.context.settings.set("terminal.defaultShell", "zsh");

    expect([systemDefault, keys()]).toEqual([
      [["Bash (default)", "Ctrl+Shift+`"], ["Zsh", null]],
      [["Bash", null], ["Zsh (default)", "Ctrl+Shift+`"]]
    ]);
  });

  it("opens the default shell from its row as New Terminal does, and keeps the other rows' command out of command search", async () => {
    const runtime: FakeRuntime = new FakeRuntime();
    await createPart().activateAsync(runtime.context);
    await vi.waitFor(() => expect(runtime.context.refreshedSettings).toEqual(["terminal.defaultShell"]), { timeout: SpecWait.milliseconds });
    const rows: readonly MenuRowContribution[] = runtime.context.menuGroups.get("terminal.shellList")?.({}) ?? [];
    const withShell: CommandContribution | undefined = runtime.context.commands.find(t => t.name === "terminal.newWithShell");

    await runRowAsync(runtime, rows[0], {});

    expect(runtime.context.sent(TerminalNames.openMethod).map(t => (t as { shellId: string | null }).shellId)).toEqual([null]);
    expect(runtime.context.opened.map(t => t.title)).toEqual(["Bash"]);
    expect([null, { takesNewOwner: true }, rows[1]?.commandArguments ?? null].map(t => withShell?.isEnabled(t))).toEqual([false, false, true]);
    expect(runtime.context.commands[0]?.isEnabled(null)).toBe(true);
  });

  it("refuses a run of New Terminal with Shell without a shell id, which Noldova Desktop runs although it isn't enabled, and opens nothing", async () => {
    const runtime: FakeRuntime = new FakeRuntime();
    await createPart().activateAsync(runtime.context);
    const withShell: CommandContribution | undefined = runtime.context.commands.find(t => t.name === "terminal.newWithShell");

    const refused: Promise<JsonValue> | undefined = withShell?.runAsync({ takesNewOwner: true });
    await expect(refused).rejects.toBeInstanceOf(ArgumentException);
    await expect(refused).rejects.toThrow("New Terminal with Shell needs a shell id. (Parameter 'shellId')");

    expect(runtime.context.sent(TerminalNames.openMethod)).toEqual([]);
  });

  it("lists the shells again, and logs it, when a shell its shell menu row gives can't open, and not when the default shell can't", async () => {
    const runtime: FakeRuntime = new FakeRuntime();
    await createPart().activateAsync(runtime.context);
    await vi.waitFor(() => expect(runtime.context.refreshedSettings).toHaveLength(1), { timeout: SpecWait.milliseconds });
    const rows: readonly MenuRowContribution[] = runtime.context.menuGroups.get("terminal.shellList")?.({ tabGroup: "g2" }) ?? [];
    runtime.shells.splice(1, 1);
    runtime.openFailure = new Error("No shell zsh.");

    await expect(runRowAsync(runtime, rows[1], { tabGroup: "g2" })).rejects.toThrow("No shell zsh.");
    await vi.waitFor(() => expect(runtime.context.refreshedSettings).toHaveLength(2), { timeout: SpecWait.milliseconds });
    await expect(runtime.context.commands[0]?.runAsync(null)).rejects.toThrow("No shell zsh.");

    expect(runtime.context.menuGroups.get("terminal.shellList")?.({ tabGroup: "g2" }).map(t => t.label)).toEqual(["Bash (default)"]);
    expect(runtime.context.sent(TerminalNames.shellsMethod)).toHaveLength(2);
    expect(runtime.context.logs).toEqual(["A terminal could not open with the shell zsh, so the shell menu lists the shells again: No shell zsh."]);
    expect(runtime.context.opened).toEqual([]);
  });

  it("supplies the Default shell setting's options once the shells are listed", async () => {
    const runtime: FakeRuntime = new FakeRuntime();

    await createPart().activateAsync(runtime.context);

    await vi.waitFor(() => expect(runtime.context.settingOptions.get("terminal.defaultShell")?.({})?.map(t => t.value)).toEqual(["", "bash", "zsh"]),
      { timeout: SpecWait.milliseconds });
  });

  it("opens a new terminal in the folder and with the shell its arguments give", async () => {
    const runtime: FakeRuntime = new FakeRuntime();
    await createPart().activateAsync(runtime.context);

    await runtime.context.commands[0]?.runAsync({ folder: "/work/project", shellId: "zsh" });

    expect(runtime.context.sent(TerminalNames.openMethod)).toEqual([{ shellId: "zsh", folder: "/work/project", size: { cols: 80, rows: 24 }, storedLimit: 104_857_600, isPanelTerminal: false, owner: null }]);
  });

  it("opens a new terminal in the start folder with the default shell when its arguments' folder and shell are null", async () => {
    const runtime: FakeRuntime = new FakeRuntime();
    await createPart().activateAsync(runtime.context);
    const unregister: () => void = TerminalStartFolder.provide(runtime.context, () => "/work/project");

    try {
      await runtime.context.commands[0]?.runAsync({ folder: null, shellId: null });
    }
    finally {
      unregister();
    }

    expect(runtime.context.sent(TerminalNames.openMethod)).toEqual([{ shellId: null, folder: "/work/project", size: { cols: 80, rows: 24 }, storedLimit: 104_857_600, isPanelTerminal: false, owner: null }]);
  });

  it("refuses arguments with a relative folder, a blank shell or a field it doesn't know, and opens nothing", async () => {
    const runtime: FakeRuntime = new FakeRuntime();
    await createPart().activateAsync(runtime.context);
    const runAsync: (commandArguments: JsonValue) => Promise<JsonValue> = t => runtime.context.commands[0]?.runAsync(t) ?? Promise.resolve(null);

    const relative: Promise<JsonValue> = runAsync({ folder: "work" });
    await expect(relative).rejects.toBeInstanceOf(ArgumentException);
    await expect(relative).rejects.toThrow("The value must be an absolute path. (Parameter 'folder')");
    const blankShell: Promise<JsonValue> = runAsync({ shellId: " " });
    await expect(blankShell).rejects.toBeInstanceOf(ArgumentException);
    await expect(blankShell).rejects.toThrow("The value must not be blank. (Parameter 'shellId')");
    const blankGroup: Promise<JsonValue> = runAsync({ tabGroup: " " });
    await expect(blankGroup).rejects.toBeInstanceOf(ArgumentException);
    await expect(blankGroup).rejects.toThrow("The value must not be blank. (Parameter 'tabGroup')");
    await expect(runAsync({ cwd: "/work" })).rejects.toThrow(JsonException);

    expect(runtime.context.sent(TerminalNames.openMethod)).toEqual([]);
  });

  describe("with an app's owners", () => {
    const provided: TerminalOwners[] = [];

    afterEach(async () => {
      for (const owners of provided.splice(0))
        await owners.removeAsync();
    });

    function provide(runtime: FakeRuntime, newOwner: () => string | null): TerminalOwners {
      const owners: TerminalOwners = TerminalOwners.provide(runtime.context, newOwner);
      provided.push(owners);
      return owners;
    }

    function openedOwners(runtime: FakeRuntime): (string | null)[] {
      return runtime.context.sent(TerminalNames.openMethod).map(t => (t as { owner: string | null }).owner);
    }

    it("reopens no tab, as the part activates with the owner already shown, for a terminal a run opened without one", async () => {
      const runtime: FakeRuntime = new FakeRuntime();
      runtime.addSession("c42", "bash", "/work", null, false, false, "example.chat/42");
      runtime.addSession("r42", "bash", "/work", null, false, false, "example.chat/42", false);
      await provide(runtime, () => null).showAsync("example.chat/42");

      await createPart().activateAsync(runtime.context);

      expect([TerminalOwners.shown, runtime.context.opened.map(t => t.instance)]).toEqual(["example.chat/42", ["c42"]]);
    });

    it("reopens no tab for an owned terminal after a reload, until the app shows its owner", async () => {
      const runtime: FakeRuntime = new FakeRuntime();
      runtime.addSession("c42", "bash", "/work", null, false, false, "example.chat/42");
      runtime.addSession("s1", "bash", "/work");

      await createPart().activateAsync(runtime.context);
      expect(runtime.context.opened.map(t => t.instance)).toEqual(["s1"]);
      await provide(runtime, () => null).showAsync("example.chat/42");

      expect(runtime.context.opened.map(t => t.instance)).toEqual(["s1", "c42"]);
    });

    it("opens the tabs of an owner the app showed before the part activated", async () => {
      const runtime: FakeRuntime = new FakeRuntime();
      runtime.addSession("c42", "bash", "/work", null, false, false, "example.chat/42");
      runtime.addSession("s1", "bash", "/work");
      await provide(runtime, () => null).showAsync("example.chat/42");
      const before: string[] = runtime.context.opened.map(t => t.instance);

      await createPart().activateAsync(runtime.context);

      expect([before, runtime.context.opened.map(t => t.instance)]).toEqual([[], ["c42", "s1"]]);
    });

    it("opens a terminal for the owner its arguments give, in a tab while the owner shows and hidden while it doesn't", async () => {
      const runtime: FakeRuntime = new FakeRuntime();
      await createPart().activateAsync(runtime.context);
      await provide(runtime, () => "example.chat/1").showAsync("example.chat/42");

      await runtime.context.commands[0]?.runAsync({ owner: "example.chat/42", tabGroup: "g2" });
      await runtime.context.commands[0]?.runAsync({ owner: "example.chat/7" });

      expect(openedOwners(runtime)).toEqual(["example.chat/42", "example.chat/7"]);
      expect(runtime.context.opened.map(t => [t.instance, t.options?.tabGroup])).toEqual([["opened-1", "g2"]]);
      expect(runtime.sessions.map(t => [t.sessionId, t.owner])).toEqual([["opened-1", "example.chat/42"], ["opened-2", "example.chat/7"]]);
      expect(runtime.context.logs).toEqual([]);
    });

    function holdTabNames(runtime: FakeRuntime): { readonly listing: HeldAnswer; readonly isAsked: () => boolean } {
      const first: number = runtime.listingCount;
      const listing: HeldAnswer = runtime.holdListings(t => t === 1);
      return { listing, isAsked: () => runtime.listingCount > first };
    }

    it("opens no tab for a terminal from + that the runtime closed by its owner while its tab waited, whatever else the runtime closes", async () => {
      const runtime: FakeRuntime = new FakeRuntime();
      await createPart().activateAsync(runtime.context);
      await vi.waitFor(() => expect(runtime.context.refreshedSettings).toEqual(["terminal.defaultShell"]), { timeout: SpecWait.milliseconds });
      await provide(runtime, () => "example.chat/42").showAsync("example.chat/42");
      const held: { readonly listing: HeldAnswer; readonly isAsked: () => boolean } = holdTabNames(runtime);

      const opening: Promise<JsonValue> | undefined = runtime.context.commands[0]?.runAsync({ ...PLUS_ARGUMENTS });
      await vi.waitFor(() => expect(held.isAsked()).toBe(true), { timeout: SpecWait.milliseconds });
      runtime.context.emit(TerminalNames.closedEvent, { sessionId: 7 });
      runtime.context.emit(TerminalNames.closedEvent, { sessionId: "opened-1" });
      held.listing.resolve(null);
      await opening;

      expect(openedOwners(runtime)).toEqual(["example.chat/42"]);
      expect(runtime.context.opened).toEqual([]);
      expect(runtime.context.logs).toHaveLength(1);
    });

    it("opens no tab for a terminal from + whose owner the app stopped showing while its tab waited", async () => {
      const runtime: FakeRuntime = new FakeRuntime();
      await createPart().activateAsync(runtime.context);
      await vi.waitFor(() => expect(runtime.context.refreshedSettings).toEqual(["terminal.defaultShell"]), { timeout: SpecWait.milliseconds });
      const owners: TerminalOwners = provide(runtime, () => "example.chat/42");
      await owners.showAsync("example.chat/42");
      const held: { readonly listing: HeldAnswer; readonly isAsked: () => boolean } = holdTabNames(runtime);

      const opening: Promise<JsonValue> | undefined = runtime.context.commands[0]?.runAsync({ ...PLUS_ARGUMENTS });
      await vi.waitFor(() => expect(held.isAsked()).toBe(true), { timeout: SpecWait.milliseconds });
      await owners.showAsync("example.chat/7");
      held.listing.resolve(null);
      await opening;

      expect(openedOwners(runtime)).toEqual(["example.chat/42"]);
      expect(runtime.context.opened).toEqual([]);
    });

    it("logs a terminal from + for a new owner the window doesn't show, which opens without a tab", async () => {
      const runtime: FakeRuntime = new FakeRuntime();
      await createPart().activateAsync(runtime.context);
      await provide(runtime, () => "example.chat/7").showAsync("example.chat/42");

      await runtime.context.commands[0]?.runAsync({ ...PLUS_ARGUMENTS });

      expect(openedOwners(runtime)).toEqual(["example.chat/7"]);
      expect(runtime.context.opened).toEqual([]);
      expect(runtime.context.logs).toEqual([
        "The terminal opened for the app's new owner example.chat/7, which the window doesn't show, so it has no tab until that owner shows."
      ]);
    });

    it("opens a terminal without an owner from Ctrl+Shift+` and the View menu, whatever the app's new owner", async () => {
      const runtime: FakeRuntime = new FakeRuntime();
      await createPart().activateAsync(runtime.context);
      provide(runtime, () => "example.chat/42");

      await runtime.context.commands[0]?.runAsync(null);
      await runtime.context.commands[0]?.runAsync({ owner: null });

      expect(openedOwners(runtime)).toEqual([null, null]);
      expect(runtime.context.opened.map(t => t.instance)).toEqual(["opened-1", "opened-2"]);
    });

    it("gives the app's new owner to a terminal from + and Toggle Terminal's first open, asked at each, but none to a shell menu row's", async () => {
      const runtime: FakeRuntime = new FakeRuntime();
      await createPart().activateAsync(runtime.context);
      await vi.waitFor(() => expect(runtime.context.refreshedSettings).toEqual(["terminal.defaultShell"]), { timeout: SpecWait.milliseconds });
      let owner: string | null = "example.chat/42";
      await provide(runtime, () => owner).showAsync("example.chat/42");
      const rows: readonly MenuRowContribution[] = runtime.context.menuGroups.get("terminal.shellList")?.({ tabGroup: "g2" }) ?? [];
      const toggle: CommandContribution | undefined = runtime.context.commands.find(t => t.name === "terminal.toggle");

      await runtime.context.commands[0]?.runAsync({ ...PLUS_ARGUMENTS, tabGroup: "g2" });
      await runRowAsync(runtime, rows[0], { tabGroup: "g2" });
      await runRowAsync(runtime, rows[1], { tabGroup: "g2" });
      await toggle?.runAsync(null);
      owner = null;
      await runtime.context.commands[0]?.runAsync({ ...PLUS_ARGUMENTS, tabGroup: "g2" });

      expect(openedOwners(runtime)).toEqual(["example.chat/42", null, null, "example.chat/42", null]);
      expect(runtime.context.opened.map(t => t.instance)).toEqual(["opened-1", "opened-2", "opened-3", "opened-4", "opened-5"]);
    });

    it("opens a terminal without an owner from + while no app provides owners", async () => {
      const runtime: FakeRuntime = new FakeRuntime();
      await createPart().activateAsync(runtime.context);

      await runtime.context.commands[0]?.runAsync({ ...PLUS_ARGUMENTS });

      expect(openedOwners(runtime)).toEqual([null]);
    });

    it("closes the tab of each terminal the runtime closed for its owner, without ending it again, and logs a message it can't read", async () => {
      const runtime: FakeRuntime = new FakeRuntime();
      runtime.addSession("c42", "bash", "/work", null, false, false, "example.chat/42");
      await createPart().activateAsync(runtime.context);
      const owners: TerminalOwners = provide(runtime, () => null);
      await owners.showAsync("example.chat/42");

      await owners.closeAsync("example.chat/42");
      runtime.context.emit(TerminalNames.closedEvent, { sessionId: "" });

      expect(runtime.context.closed).toEqual(["c42"]);
      expect(runtime.context.sent(TerminalNames.closeMethod)).toEqual([]);
      expect(runtime.context.logs).toHaveLength(1);
      expect(runtime.context.logs[0]).toMatch(/^A terminal's tab closed by its owner could not be closed: \S/u);
    });

    it("opens a tab for an agent's terminal opened for the owner it shows, none for another owner's, one without an owner or one a run opened without a tab, and logs a message it can't read", async () => {
      const runtime: FakeRuntime = new FakeRuntime();
      await createPart().activateAsync(runtime.context);
      await provide(runtime, () => null).showAsync("example.chat/42");
      runtime.addSession("a42", "bash", "/work", null, true, false, "example.chat/42");

      runtime.context.emit(TerminalNames.openedEvent, new TerminalSummary("a7", "bash", "/work", "", null, true, false, "example.chat/7", true, null, null, TerminalShellKind.Other).toJson());
      runtime.context.emit(TerminalNames.openedEvent, new TerminalSummary("a1", "bash", "/work", "", null, true, false, null, true, null, null, TerminalShellKind.Other).toJson());
      runtime.context.emit(TerminalNames.openedEvent, new TerminalSummary("r42", "bash", "/work", "", null, false, false, "example.chat/42", false, null, null, TerminalShellKind.Other).toJson());
      runtime.context.emit(TerminalNames.openedEvent, { sessionId: 7 });
      runtime.context.emit(TerminalNames.openedEvent, new TerminalSummary("a42", "bash", "/work", "", null, true, false, "example.chat/42", true, null, null, TerminalShellKind.Other).toJson());

      await vi.waitFor(() => expect(runtime.context.opened.map(t => [t.instance, t.title])).toEqual([["a42", "Bash"]]), { timeout: SpecWait.milliseconds });
      expect([TerminalFocus.takeUnasked("a42"), TerminalFocus.takeUnasked("a7"), TerminalFocus.takeUnasked("r42")]).toEqual([true, false, false]);
      expect(runtime.context.logs).toHaveLength(1);
      expect(runtime.context.logs[0]).toMatch(/^An agent's terminal opened for an owner could not get its tab: \S/u);
    });

    it("marks no unasked opening for an agent's terminal whose tab is already open, since its pane is made already", async () => {
      const runtime: FakeRuntime = new FakeRuntime();
      await createPart().activateAsync(runtime.context);
      await provide(runtime, () => null).showAsync("example.chat/42");
      runtime.addSession("a42", "bash", "/work", null, true, false, "example.chat/42");
      const remove: () => void = TerminalRestartTargets.add("terminal.session", "a42", { canRestart: () => false, restartAsync: async () => undefined });

      try {
        runtime.context.emit(TerminalNames.openedEvent, new TerminalSummary("a42", "bash", "/work", "", null, true, false, "example.chat/42", true, null, null, TerminalShellKind.Other).toJson());
        await vi.waitFor(() => expect(runtime.context.opened.map(t => t.instance)).toEqual(["a42"]), { timeout: SpecWait.milliseconds });
      }
      finally {
        remove();
      }

      expect(TerminalFocus.takeUnasked("a42")).toBe(false);
    });

    it("opens no tab for an agent's terminal whose owner the app stopped showing while its tab waited", async () => {
      const runtime: FakeRuntime = new FakeRuntime();
      await createPart().activateAsync(runtime.context);
      const owners: TerminalOwners = provide(runtime, () => null);
      await owners.showAsync("example.chat/42");
      const held: { readonly listing: HeldAnswer; readonly isAsked: () => boolean } = holdTabNames(runtime);
      const openTabs: MockInstance<TerminalRuntimeClient["openTabsAsync"]> = vi.spyOn(TerminalRuntimeClient.prototype, "openTabsAsync");

      try {
        runtime.context.emit(TerminalNames.openedEvent, new TerminalSummary("a42", "bash", "/work", "", null, true, false, "example.chat/42", true, null, null, TerminalShellKind.Other).toJson());
        await vi.waitFor(() => expect(held.isAsked()).toBe(true), { timeout: SpecWait.milliseconds });
        await owners.showAsync("example.chat/7");
        held.listing.resolve(null);
        await Promise.all(openTabs.mock.results.map(t => t.value));
        expect(openTabs.mock.calls.map(t => t[0])).toContainEqual(["a42"]);
      }
      finally {
        openTabs.mockRestore();
      }

      expect([runtime.context.opened, runtime.context.logs]).toEqual([[], []]);
    });

    it("refuses an owner that is blank or too long, or that comes with takesNewOwner, and opens nothing", async () => {
      const runtime: FakeRuntime = new FakeRuntime();
      await createPart().activateAsync(runtime.context);
      const runAsync: (commandArguments: JsonValue) => Promise<JsonValue> = t => runtime.context.commands[0]?.runAsync(t) ?? Promise.resolve(null);

      const blank: Promise<JsonValue> = runAsync({ owner: " " });
      await expect(blank).rejects.toBeInstanceOf(ArgumentException);
      await expect(blank).rejects.toThrow("The value must not be blank. (Parameter 'owner')");
      await expect(runAsync({ owner: "o".repeat(257) })).rejects.toThrow(JsonException);
      const twice: Promise<JsonValue> = runAsync({ owner: "example.chat/42", takesNewOwner: true });
      await expect(twice).rejects.toBeInstanceOf(ArgumentException);
      await expect(twice).rejects.toThrow("The value can't come with an owner. (Parameter 'takesNewOwner')");
      await expect(runAsync({ takesNewOwner: "yes" })).rejects.toThrow(JsonException);

      expect(runtime.context.sent(TerminalNames.openMethod)).toEqual([]);
    });
  });

  it("keeps its new-terminal places plain menus another module's groups add to, after its own, each running that module's command", async () => {
    const runtime: FakeRuntime = new FakeRuntime();
    await createPart().activateAsync(runtime.context);
    const newTerminalAsync: (commandArguments: JsonValue) => Promise<JsonValue> = t => runtime.context.commands[0]?.runAsync(t) ?? Promise.resolve(null);
    const commands: ReadonlyMap<string, (commandArguments: { chat: string; tabGroup: string; shellId?: string }) => Promise<JsonValue>> = new Map([
      ["chats.newChatTerminal", t => newTerminalAsync({ owner: `chats.chat/${t.chat}`, tabGroup: t.tabGroup })],
      ["chats.newChatShell", t => newTerminalAsync({ owner: `chats.chat/${t.chat}`, shellId: t.shellId ?? null, tabGroup: t.tabGroup })]
    ]);
    const owners: TerminalOwners = TerminalOwners.provide(runtime.context, () => null);
    try {
      await owners.showAsync("chats.chat/42");
      for (const group of chatsMenus.groups)
        for (const item of group.items) {
          expect(chatsModule.contributes.commands).toContain(item.command);
          await commands.get(item.command)?.({ ...item.arguments, tabGroup: "g2" });
        }
    }
    finally {
      await owners.removeAsync();
    }

    expect(menus.places.map(t => [t.name, (t as { shows?: string }).shows ?? "menu"])).toEqual([["terminal.tabRow", "menu"], ["terminal.shellMenu", "menu"]]);
    expect(menus.groups.filter(t => t.place.startsWith("terminal.")).map(t => [t.place, t.name])).toEqual([
      ["terminal.tabRow", "terminal.tabRowActions"], ["terminal.shellMenu", "terminal.shellList"]]);
    expect(chatsModule.dependencies).toHaveProperty("terminal");
    expect(chatsMenus.groups.map(t => t.place)).toEqual(["terminal.tabRow", "terminal.shellMenu"]);

    expect(runtime.context.sent(TerminalNames.openMethod).map(t => [(t as { shellId: string | null }).shellId, (t as { owner: string | null }).owner]))
      .toEqual([[null, "chats.chat/42"], ["zsh", "chats.chat/42"]]);
    expect(runtime.context.opened.map(t => [t.instance, t.options?.tabGroup])).toEqual([["opened-1", "g2"], ["opened-2", "g2"]]);
  });

  it("asks a runtime that started again for the last run's terminals before the panes attach again, and attaches them after a failed restore", async () => {
    const runtime: FakeRuntime = new FakeRuntime();
    const part: TerminalWindowPart = createPart();
    await part.activateAsync(runtime.context);
    runtime.saved.push(new TerminalSummary("s1", "bash", "/work", "", null, false, false, null, true, null, null, TerminalShellKind.Other));
    const order: string[] = [];
    const reattach = vi.spyOn(TerminalConnection, "reattachAll").mockImplementation(() => void order.push(`reattach with ${runtime.sessions.map(t => t.sessionId).join(",")}`));

    try {
      expect(await part.reconnectAsync()).toBe(true);
      runtime.context.handlers.set(TerminalNames.restoreMethod, () => Promise.reject(new Error("The runtime is gone.")));
      expect(await part.reconnectAsync()).toBe(true);
    }
    finally {
      reattach.mockRestore();
    }

    expect(order).toEqual(["reattach with s1", "reattach with s1"]);
    expect(runtime.context.sent(TerminalNames.restoreMethod)).toHaveLength(3);
    expect(runtime.context.logs).toEqual(["The terminals the last run left open could not be opened again: The runtime is gone."]);
  });

  it("restarts the terminal of the tab the tab menu opened on, and applies only to a terminal tab or the panel that can restart", async () => {
    const runtime: FakeRuntime = new FakeRuntime();
    await createPart().activateAsync(runtime.context);
    const restart: CommandContribution | undefined = runtime.context.commands.find(t => t.name === "terminal.restartShell");
    const restarted: string[] = [];
    let canRestart: boolean = true;
    const target = (name: string): ITerminalRestartTarget => ({
      canRestart: (): boolean => canRestart,
      restartAsync: async (): Promise<void> => void restarted.push(name)
    });
    const removals: (() => void)[] = [
      TerminalRestartTargets.add("terminal.session", "s1", target("s1")),
      TerminalRestartTargets.add("terminal.panel", null, target("panel"))
    ];

    try {
      expect([{ tab: "view/terminal.session/s1" }, { tab: "view/terminal.panel" }, { tab: "view/terminal.session/s2" }, { tab: "view/clock.face" }, null]
        .map(t => restart?.isApplicable(t))).toEqual([true, true, false, false, false]);
      expect(await restart?.runAsync({ tab: "view/terminal.session/s1" })).toBeNull();
      await restart?.runAsync({ tab: "view/terminal.panel", tabGroup: "g1" });
      await restart?.runAsync({ tab: "view/terminal.session/s2" });
      canRestart = false;
      expect(restart?.isApplicable({ tab: "view/terminal.session/s1" })).toBe(false);
    }
    finally {
      for (const remove of removals)
        remove();
    }

    expect(restarted).toEqual(["s1", "panel"]);
  });

  it("retitles a terminal's tab renamed here or in another window, and refuses a payload it can't read, which Noldova Desktop logs", async () => {
    const runtime: FakeRuntime = new FakeRuntime();
    runtime.addSession("s1", "bash", "/work");
    await createPart().activateAsync(runtime.context);

    await runtime.context.requestAsync(TerminalNames.renameMethod, { sessionId: "s1", name: "Server" });
    runtime.rename(new TerminalName("s1", null));
    await vi.waitFor(() => expect(runtime.context.updates).toHaveLength(2), { timeout: SpecWait.milliseconds });

    expect(runtime.context.updates).toEqual([["s1", { title: "Server" }], ["s1", { title: "Bash", icon: "attach_money" }]]);
    expect(() => runtime.context.emit(TerminalNames.renamedEvent, { sessionId: "s1" })).toThrow(JsonException);
  });

  it("logs a renamed terminal's tab it could not retitle", async () => {
    const runtime: FakeRuntime = new FakeRuntime();
    await createPart().activateAsync(runtime.context);
    vi.spyOn(runtime.context, "updateView").mockImplementation(() => {
      throw new Error("The title is blank.");
    });

    runtime.rename(new TerminalName("s1", "Server"));

    await vi.waitFor(() => expect(runtime.context.logs).toEqual(["A renamed terminal's tab could not be retitled: The title is blank."]), { timeout: SpecWait.milliseconds });
  });

  it("renames a terminal whose tab was renamed in place, an empty title taking the name away, and its tab menu adds only Restart", async () => {
    const runtime: FakeRuntime = new FakeRuntime();
    runtime.addSession("s1", "bash", "/work");
    await createPart().activateAsync(runtime.context);

    runtime.context.renameTab("terminal.session", "s1", "Server");
    await vi.waitFor(() => expect(runtime.context.updates).toHaveLength(1), { timeout: SpecWait.milliseconds });
    runtime.context.renameTab("terminal.session", "s1", "");
    await vi.waitFor(() => expect(runtime.context.updates).toHaveLength(2), { timeout: SpecWait.milliseconds });

    expect(runtime.context.sent(TerminalNames.renameMethod)).toEqual([{ sessionId: "s1", name: "Server" }, { sessionId: "s1", name: null }]);
    expect(runtime.context.updates).toEqual([["s1", { title: "Server" }], ["s1", { title: "Bash", icon: "attach_money" }]]);
    expect(menus.groups.filter(t => t.place === "desktop.tab").map(t => [t.name, t.items?.map(u => ["command" in u ? u.command : null, "label" in u ? u.label : null])]))
      .toEqual([["terminal.tabActions", [["terminal.restartShell", "Restart"]]]]);
  });

  it("logs a terminal it could not rename in place, and the tab keeps its title", async () => {
    const runtime: FakeRuntime = new FakeRuntime();
    runtime.addSession("s1", "bash", "/work");
    await createPart().activateAsync(runtime.context);
    runtime.context.handlers.set(TerminalNames.renameMethod, async () => {
      throw new Error("The terminal is gone.");
    });

    runtime.context.renameTab("terminal.session", "s1", "Server");

    await vi.waitFor(() => expect(runtime.context.logs).toEqual(["A terminal could not be renamed: The terminal is gone."]), { timeout: SpecWait.milliseconds });
    expect(runtime.context.updates).toEqual([]);
  });

  it("titles the tabs it reopened plain while the runtime couldn't list its terminals once the runtime started again", async () => {
    const runtime: FakeRuntime = new FakeRuntime();
    const part: TerminalWindowPart = createPart();
    runtime.addSession("s1", "bash", "/work");
    runtime.sessionsFailure = new Error("The runtime is busy.");
    runtime.sessionsFailureFrom = 2;
    await part.activateAsync(runtime.context);
    runtime.sessionsFailure = null;
    const reattach = vi.spyOn(TerminalConnection, "reattachAll").mockImplementation(() => undefined);

    try {
      expect(await part.reconnectAsync()).toBe(true);
    }
    finally {
      reattach.mockRestore();
    }

    expect(runtime.context.opened.map(t => [t.instance, t.title])).toEqual([["s1", "Terminal"]]);
    expect(runtime.context.updates).toEqual([["s1", { title: "Bash", icon: "attach_money" }]]);
  });

  it("goes on after the runtime reconnects, and deactivates without work of its own", async () => {
    const part: TerminalWindowPart = createPart();

    expect(await part.reconnectAsync()).toBe(true);
    await expect(part.deactivateAsync()).resolves.toBeUndefined();
  });

  it("serves an app's launches while it is active, ends them as Detach when the runtime starts again, and refuses them once it deactivates", async () => {
    const runtime: FakeRuntime = new FakeRuntime();
    const part: TerminalWindowPart = createPart();
    await part.activateAsync(runtime.context);
    const launched: LaunchedTerminal = await TerminalLauncher.openAsync(runtime.context, new TerminalLaunch("/work", {}, null, "Sign in"));

    expect(await part.reconnectAsync()).toBe(true);
    expect(await launched.ended).toEqual(new TerminalEnd("Detach", null));
    expect(runtime.context.opened.map(t => [t.instance, t.title])).toContainEqual(["launched-1", "Sign in"]);
    await part.deactivateAsync();
    await expect(TerminalLauncher.openAsync(runtime.context, new TerminalLaunch("/work"))).rejects.toThrow(LaunchPartInactiveException);
  });

  it("ends an app's launches as Detach when it deactivates, so a module turned off in a running window leaves no launch waiting", async () => {
    const runtime: FakeRuntime = new FakeRuntime();
    const part: TerminalWindowPart = createPart();
    await part.activateAsync(runtime.context);
    const launched: LaunchedTerminal = await TerminalLauncher.openAsync(runtime.context, new TerminalLaunch("/work", {}, null, "Sign in"));

    await part.deactivateAsync();

    expect(await launched.ended).toEqual(new TerminalEnd("Detach", null));
  });
});
