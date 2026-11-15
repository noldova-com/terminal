/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { FailureCode } from "@noldova/desktop.protocol";
import { EndedBy, TerminalExit, TerminalName, TerminalNames, TerminalReference, TerminalShell, TerminalShellKind, TerminalSize } from "@noldova/terminal.protocol";
import { describe, expect, it, type MockInstance, vi } from "vitest";

import { TerminalRuntimeClient } from "../../../src/app/services/terminal-runtime-client.ts";
import { TerminalStartFolder } from "../../../src/app/services/terminal-start-folder.ts";
import { FakeRuntime } from "../../fixtures/fake-runtime.fixture.ts";
import { HeldAnswer } from "../../fixtures/held-answer.fixture.ts";

describe("TerminalRuntimeClient", () => {
  it("opens a shell at the opening size, leaving the shell and folder to the runtime when not named", async () => {
    const runtime: FakeRuntime = new FakeRuntime();

    const sessionId: string = await new TerminalRuntimeClient(runtime.context).openAsync(null, null);

    expect(sessionId).toBe("opened-1");
    expect(runtime.context.sent(TerminalNames.openMethod)).toEqual([
      { shellId: null, folder: null, size: { cols: 80, rows: 24 }, storedLimit: 104_857_600, isPanelTerminal: false, owner: null }
    ]);
  });

  it("opens the panel's own terminal as the panel's", async () => {
    const runtime: FakeRuntime = new FakeRuntime();

    await new TerminalRuntimeClient(runtime.context).openAsync(null, null, true);

    expect(runtime.context.sent(TerminalNames.openMethod)).toEqual([
      { shellId: null, folder: null, size: { cols: 80, rows: 24 }, storedLimit: 104_857_600, isPanelTerminal: true, owner: null }
    ]);
  });

  it("opens in the app's start folder, and in a folder of its own when given one", async () => {
    const runtime: FakeRuntime = new FakeRuntime();
    const client: TerminalRuntimeClient = new TerminalRuntimeClient(runtime.context);
    const unregister: () => void = TerminalStartFolder.provide(runtime.context, () => "/work/project");

    try {
      await client.openAsync(null, null);
      await client.openAsync("zsh", "/work/other");
    }
    finally {
      unregister();
    }

    expect(runtime.context.sent(TerminalNames.openMethod)).toEqual([
      { shellId: null, folder: "/work/project", size: { cols: 80, rows: 24 }, storedLimit: 104_857_600, isPanelTerminal: false, owner: null },
      { shellId: "zsh", folder: "/work/other", size: { cols: 80, rows: 24 }, storedLimit: 104_857_600, isPanelTerminal: false, owner: null }
    ]);
  });

  it("opens the Default shell setting's shell while the runtime finds it, without listing the shells, the runtime's default, logged, once it doesn't, and a shell given over both", async () => {
    const runtime: FakeRuntime = new FakeRuntime();
    const client: TerminalRuntimeClient = new TerminalRuntimeClient(runtime.context);
    runtime.context.settings.set("terminal.defaultShell", "zsh");

    await client.openAsync(null, null);
    await client.openAsync("bash", null);
    runtime.shells.splice(1, 1);
    await client.openAsync(null, null, true);

    expect(runtime.context.sent(TerminalNames.openMethod).map(t => (t as { shellId: string | null }).shellId)).toEqual(["zsh", "bash", "zsh", null]);
    expect(runtime.context.sent(TerminalNames.shellsMethod)).toEqual([]);
    expect(runtime.context.logs).toEqual(["The Default shell zsh could not open, so the terminal opens with the system default shell: The shell zsh was not found."]);
  });

  it("launches the Default shell setting's shell while the runtime finds it, else the runtime's default with the same command, logged, and fails without another launch for any other failure",
    async () => {
    const runtime: FakeRuntime = new FakeRuntime();
    const client: TerminalRuntimeClient = new TerminalRuntimeClient(runtime.context);

    await client.launchAsync("/work", { A: "1" }, null);
    runtime.context.settings.set("terminal.defaultShell", "zsh");
    await client.launchAsync("/work", { A: "1" }, "Notice", "agent login");
    runtime.shells.splice(1, 1);
    await client.launchAsync(null, {}, null, "agent login");
    runtime.openFailure = new Error("The runtime is busy.");
    await expect(client.launchAsync("/work", {}, null)).rejects.toThrow("The runtime is busy.");
    runtime.context.settings.delete("terminal.defaultShell");
    await expect(client.launchAsync("/work", {}, null)).rejects.toThrow("The runtime is busy.");

    expect(runtime.context.sent(TerminalNames.launchMethod).map(t => (t as { shellId: string | null }).shellId)).toEqual([null, "zsh", "zsh", null, "zsh", null]);
    expect(runtime.context.sent(TerminalNames.launchMethod)[1]).toEqual({ shellId: "zsh", folder: "/work", size: { cols: 80, rows: 24 },
      storedLimit: 104_857_600, environment: { A: "1" }, notice: "Notice", command: "agent login", opensTab: true });
    expect(runtime.context.sent(TerminalNames.launchMethod).map(t => (t as { command: string | null }).command)).toEqual([null, "agent login", "agent login",
      "agent login", null, null]);
    expect(runtime.context.logs).toEqual([
      "The Default shell zsh could not open, so the terminal opens with the system default shell: The shell zsh was not found."
    ]);
  });

  it("sends a launch's shell kinds with the Default shell setting's shell, and fails a refused launch with kinds without trying the system default",
    async () => {
    const runtime: FakeRuntime = new FakeRuntime();
    const client: TerminalRuntimeClient = new TerminalRuntimeClient(runtime.context);
    runtime.context.settings.set("terminal.defaultShell", "zsh");

    await client.launchAsync("/work", {}, null, "tool auth login", false, [TerminalShellKind.PowerShell, TerminalShellKind.CommandPrompt]);
    runtime.shells.splice(1, 1);
    await expect(client.launchAsync("/work", {}, null, null, true, [TerminalShellKind.CommandPrompt])).rejects.toThrow("The shell zsh was not found.");

    expect(runtime.context.sent(TerminalNames.launchMethod).map(t => [(t as { shellId: string | null }).shellId, (t as { shellKinds?: string[] }).shellKinds]))
      .toEqual([["zsh", ["PowerShell", "CommandPrompt"]], ["zsh", ["CommandPrompt"]]]);
    expect(runtime.context.logs).toEqual([]);
  });

  it("titles a launched terminal's tab with the app's title, which a later listing leaves, even while the terminals can't be listed", async () => {
    const runtime: FakeRuntime = new FakeRuntime();
    const client: TerminalRuntimeClient = new TerminalRuntimeClient(runtime.context);
    runtime.addSession("launched-1", "bash", "/work");
    runtime.sessionsFailure = new Error("The terminals can't be read.");

    await client.openTabsAsync(["launched-1"], null, () => true, true, "Sign in");
    runtime.sessionsFailure = null;
    await client.nameTabsAsync();

    expect(runtime.context.opened.map(t => t.title)).toEqual(["Sign in"]);
    expect(runtime.context.updates).toEqual([]);
  });

  it("leaves the shell to the runtime without listing the shells while the Default shell setting is empty, blank, longer than a shell id may be or not loaded", async () => {
    const runtime: FakeRuntime = new FakeRuntime();
    const client: TerminalRuntimeClient = new TerminalRuntimeClient(runtime.context);

    await client.openAsync(null, null);
    for (const shellId of ["", " ", "s".repeat(201)]) {
      runtime.context.settings.set("terminal.defaultShell", shellId);
      await client.openAsync(null, null);
    }

    expect(runtime.context.sent(TerminalNames.openMethod).map(t => (t as { shellId: string | null }).shellId)).toEqual([null, null, null, null]);
    expect(runtime.context.sent(TerminalNames.shellsMethod)).toEqual([]);
  });

  it("fails an open the runtime refuses for a shell it was given or for its own default, and one that fails otherwise without opening the system default", async () => {
    const runtime: FakeRuntime = new FakeRuntime();
    const client: TerminalRuntimeClient = new TerminalRuntimeClient(runtime.context);

    await expect(client.openAsync("fish", null)).rejects.toThrow("The shell fish was not found.");
    runtime.openFailure = new Error("The runtime is busy.");
    await expect(client.openAsync(null, null)).rejects.toThrow("The runtime is busy.");
    runtime.context.settings.set("terminal.defaultShell", "zsh");
    await expect(client.openAsync(null, null)).rejects.toThrow("The runtime is busy.");

    expect(runtime.context.sent(TerminalNames.openMethod).map(t => (t as { shellId: string | null }).shellId)).toEqual(["fish", null, "zsh"]);
    expect(runtime.context.logs).toEqual([]);
  });

  it("takes only a failure with the code NotFound as the runtime no longer finding a shell", () => {
    const notFound: Error = Object.assign(new Error("The shell zsh was not found."), { code: FailureCode.NotFound });
    const busy: Error = Object.assign(new Error("The runtime is busy."), { code: FailureCode.Internal });

    expect([notFound, busy, new Error("The runtime is busy."), "NotFound", { code: FailureCode.NotFound }].map(t => TerminalRuntimeClient.isNotFound(t)))
      .toEqual([true, false, false, false, false]);
  });

  it("takes only an error with the runtime's string code as a refusal, so a defect's TypeError or a malformed answer is none", () => {
    const notFound: Error = Object.assign(new Error("The shell zsh was not found."), { code: FailureCode.NotFound });
    const busy: Error = Object.assign(new Error("The runtime is busy."), { code: "Internal" });
    const numbered: Error = Object.assign(new Error("The runtime is busy."), { code: 7 });

    expect([notFound, busy, numbered, new TypeError("sessions is undefined"), new Error("The runtime is busy."), { code: "Internal" }]
      .map(t => TerminalRuntimeClient.isRefusal(t))).toEqual([true, true, false, false, false, false]);
  });

  it("keeps the output the Output kept setting allows, in megabytes, and the default for a value it can't take", async () => {
    const runtime: FakeRuntime = new FakeRuntime();
    const client: TerminalRuntimeClient = new TerminalRuntimeClient(runtime.context);

    for (const limit of [10, 10_000, 9, 10_001, 10.5, "100", null]) {
      runtime.context.settings.set("terminal.outputLimit", limit);
      await client.openAsync(null, null);
    }

    expect(runtime.context.sent(TerminalNames.openMethod).map(t => (t as { storedLimit: number }).storedLimit))
      .toEqual([10_485_760, 10_485_760_000, 104_857_600, 104_857_600, 104_857_600, 104_857_600, 104_857_600]);
  });

  it("asks for the last run's terminals with the Default shell setting's shell and the output the Output kept setting allows, and the runtime's defaults while they are empty or not loaded", async () => {
    const runtime: FakeRuntime = new FakeRuntime();
    const client: TerminalRuntimeClient = new TerminalRuntimeClient(runtime.context);

    await client.restoreAsync();
    runtime.context.settings.set("terminal.defaultShell", "zsh");
    runtime.context.settings.set("terminal.outputLimit", 50);
    await client.restoreAsync();
    runtime.context.settings.set("terminal.defaultShell", " ");
    await client.restoreAsync();

    expect(runtime.context.sent(TerminalNames.restoreMethod)).toEqual([
      { size: { cols: 80, rows: 24 }, shellId: null, storedLimit: 104_857_600 },
      { size: { cols: 80, rows: 24 }, shellId: "zsh", storedLimit: 52_428_800 },
      { size: { cols: 80, rows: 24 }, shellId: null, storedLimit: 52_428_800 }
    ]);
    expect(runtime.context.sent(TerminalNames.shellsMethod)).toEqual([]);
  });

  it("still asks for the last run's terminals, leaving the shell to the runtime, when the Default shell setting is longer than a shell id may be", async () => {
    const runtime: FakeRuntime = new FakeRuntime();
    const client: TerminalRuntimeClient = new TerminalRuntimeClient(runtime.context);

    for (const shellId of ["s".repeat(200), "s".repeat(201)]) {
      runtime.context.settings.set("terminal.defaultShell", shellId);
      await client.restoreAsync();
    }

    expect(runtime.context.sent(TerminalNames.restoreMethod).map(t => (t as { shellId: string | null }).shellId)).toEqual(["s".repeat(200), null]);
  });

  it("starts an ended terminal's shell again in place, at the asking pane's size", async () => {
    const runtime: FakeRuntime = new FakeRuntime();
    runtime.addSession("s1", "zsh", "/work/project", new TerminalExit(1, EndedBy.Exit));

    expect(await new TerminalRuntimeClient(runtime.context).restartAsync("s1", new TerminalSize(120, 40))).toBe("s1");

    expect(runtime.context.sent(TerminalNames.restartMethod)).toEqual([{ sessionId: "s1", size: { cols: 120, rows: 40 } }]);
    expect(runtime.context.sent(TerminalNames.openMethod)).toEqual([]);
  });

  it("starts the default shell in the home folder when the runtime has forgotten the terminal, as a tab's or as the panel's", async () => {
    const runtime: FakeRuntime = new FakeRuntime();
    const client: TerminalRuntimeClient = new TerminalRuntimeClient(runtime.context);

    await client.restartAsync("gone", new TerminalSize(120, 40));
    await client.restartAsync("gone", new TerminalSize(120, 40), true);

    expect(runtime.context.sent(TerminalNames.openMethod)).toEqual([
      { shellId: null, folder: null, size: { cols: 80, rows: 24 }, storedLimit: 104_857_600, isPanelTerminal: false, owner: null },
      { shellId: null, folder: null, size: { cols: 80, rows: 24 }, storedLimit: 104_857_600, isPanelTerminal: true, owner: null }
    ]);
  });

  it("tells an agent's terminal from the person's, and from one the runtime has forgotten", async () => {
    const runtime: FakeRuntime = new FakeRuntime();
    const client: TerminalRuntimeClient = new TerminalRuntimeClient(runtime.context);
    runtime.addSession("s1", "bash", "/work");
    runtime.addSession("s2", "bash", "/work", null, true);

    expect([await client.isAgentTerminalAsync("s1"), await client.isAgentTerminalAsync("s2"), await client.isAgentTerminalAsync("gone")])
      .toEqual([false, true, false]);
  });

  it("lists for tabs the person's terminals and the agents' of the owner shown, ended ones too, in the order they opened, but not the panel's, an agent's without an owner, nor one a run opened without a tab", async () => {
    const runtime: FakeRuntime = new FakeRuntime();
    const client: TerminalRuntimeClient = new TerminalRuntimeClient(runtime.context);
    runtime.addSession("s1", "bash", "/work");
    runtime.addSession("a1", "bash", "/work", null, true);
    runtime.addSession("a42", "bash", "/work", null, true, false, "example.chat/42");
    runtime.addSession("c42", "bash", "/work", new TerminalExit(0, EndedBy.Exit), false, false, "example.chat/42");
    runtime.addSession("a7", "bash", "/work", null, true, false, "example.chat/7");
    runtime.addSession("p1", "bash", "/work", null, false, true);
    runtime.addSession("r42", "bash", "/work", null, false, false, "example.chat/42", false);

    expect([await client.listTabTerminalsAsync("example.chat/42"), await client.listTabTerminalsAsync(null)]).toEqual([["s1", "a42", "c42"], ["s1"]]);
  });

  it("ends an agent's terminal with an owner when its tab closes, but leaves one without an owner to its agent session", async () => {
    const runtime: FakeRuntime = new FakeRuntime();
    const client: TerminalRuntimeClient = new TerminalRuntimeClient(runtime.context);
    runtime.addSession("a1", "bash", "/work", null, true);
    runtime.addSession("a42", "bash", "/work", null, true, false, "example.chat/42");

    await client.closeAsync("a1");
    await client.closeAsync("a42");
    await client.closeAsync("gone");

    expect(runtime.context.sent(TerminalNames.closeMethod)).toEqual([{ sessionId: "a42" }]);
  });

  it("finds the panel's own terminal, ended or not, and never a tab's or an agent's", async () => {
    const runtime: FakeRuntime = new FakeRuntime();
    const client: TerminalRuntimeClient = new TerminalRuntimeClient(runtime.context);
    runtime.addSession("s1", "bash", "/work");
    runtime.addSession("s2", "bash", "/work", null, true);
    expect(await client.findPanelTerminalAsync()).toBeNull();

    runtime.addSession("p1", "bash", "/work", new TerminalExit(0, EndedBy.Exit), false, true);
    runtime.addSession("s3", "bash", "/work");

    expect(await client.findPanelTerminalAsync()).toBe("p1");
  });

  it("opens each terminal's tab titled with its shell's name and showing its kind's icon, in the group given", async () => {
    const runtime: FakeRuntime = new FakeRuntime();
    const kinds: readonly TerminalShellKind[] = Object.values(TerminalShellKind);
    runtime.shells.splice(0, runtime.shells.length, ...kinds.map((t, i) => new TerminalShell(`shell-${i}`, `${t} shell`, t, i === 0)));
    kinds.forEach((_, i) => runtime.addSession(`s${i}`, `shell-${i}`, "/work"));

    await new TerminalRuntimeClient(runtime.context).openTabsAsync(kinds.map((_, i) => `s${i}`), "g2");

    expect(runtime.context.opened.map(t => [t.name, t.instance, t.title, t.options])).toEqual([
      ["terminal.session", "s0", "PowerShell shell", { icon: "terminal", tabGroup: "g2" }],
      ["terminal.session", "s1", "CommandPrompt shell", { icon: "chevron_right", tabGroup: "g2" }],
      ["terminal.session", "s2", "Bash shell", { icon: "attach_money", tabGroup: "g2" }],
      ["terminal.session", "s3", "Zsh shell", { icon: "percent", tabGroup: "g2" }],
      ["terminal.session", "s4", "Fish shell", { icon: "set_meal", tabGroup: "g2" }],
      ["terminal.session", "s5", "Wsl shell", { icon: "deployed_code", tabGroup: "g2" }],
      ["terminal.session", "s6", "Other shell", { icon: "terminal", tabGroup: "g2" }]
    ]);
  });

  it("opens the tabs once the runtime lists its terminals, with no wait of its own, titled with their shells' names and without listing the shells", async () => {
    const runtime: FakeRuntime = new FakeRuntime();
    runtime.addSession("s1", "zsh", "/work");
    const listing: HeldAnswer = runtime.holdListings();

    const opening: Promise<void> = new TerminalRuntimeClient(runtime.context).openTabsAsync(["s1"], "g2");
    await vi.waitFor(() => expect(runtime.listingCount).toBe(1));
    expect(runtime.context.opened).toEqual([]);
    listing.resolve(null);
    await opening;

    expect(runtime.context.opened.map(t => [t.instance, t.title, t.options])).toEqual([["s1", "Zsh", { icon: "percent", tabGroup: "g2" }]]);
    expect([runtime.context.updates, runtime.context.sent(TerminalNames.shellsMethod)]).toEqual([[], []]);
  });

  it("opens the tabs plain, and logs it, when the terminals can't be listed, and no tab for a terminal the runtime closed while they were listed", async () => {
    const runtime: FakeRuntime = new FakeRuntime();
    const client: TerminalRuntimeClient = new TerminalRuntimeClient(runtime.context);
    runtime.addSession("s1", "zsh", "/work");
    runtime.addSession("s2", "zsh", "/work");
    runtime.addSession("s3", "zsh", "/work");
    runtime.sessionsFailure = new Error("The runtime is busy.");
    await client.openTabsAsync(["s1"]);
    runtime.sessionsFailure = null;
    const listing: HeldAnswer = runtime.holdListings();

    const opening: Promise<void> = client.openTabsAsync(["s2", "s3"]);
    await vi.waitFor(() => expect(runtime.listingCount).toBe(2));
    runtime.context.emit(TerminalNames.closedEvent, { sessionId: "s2" });
    listing.resolve(null);
    await opening;

    expect(runtime.context.opened.map(t => [t.instance, t.title])).toEqual([["s1", "Terminal"], ["s3", "Zsh"]]);
    expect(runtime.context.updates).toEqual([["s1", { title: "Zsh", icon: "percent" }]]);
    expect(runtime.context.logs).toEqual(["The terminal tabs show no shell names, since the terminals could not be listed: The runtime is busy."]);
  });

  it("skips a closed terminal's event it can't read while it opens the tabs, which the part logs, and passes on a failure to read it that isn't the payload's", async () => {
    const runtime: FakeRuntime = new FakeRuntime();
    const client: TerminalRuntimeClient = new TerminalRuntimeClient(runtime.context);
    runtime.addSession("s1", "zsh", "/work");
    const listing: HeldAnswer = runtime.holdListings();
    const opening: Promise<void> = client.openTabsAsync(["s1"]);
    await vi.waitFor(() => expect(runtime.listingCount).toBe(1));
    const failure: Error = new Error("The reader broke.");

    runtime.context.emit(TerminalNames.closedEvent, { sessionId: 5 });
    const reference: MockInstance<typeof TerminalReference.fromJson> = vi.spyOn(TerminalReference, "fromJson").mockImplementation(() => {
      throw failure;
    });
    try {
      expect(() => runtime.context.emit(TerminalNames.closedEvent, { sessionId: "s1" })).toThrow(failure);
    }
    finally {
      reference.mockRestore();
    }
    listing.resolve(null);
    await opening;

    expect(runtime.context.opened.map(t => [t.instance, t.title])).toEqual([["s1", "Zsh"]]);
    expect(runtime.context.logs).toEqual([]);
  });

  it("opens a plain Terminal tab for a terminal the runtime has forgotten, and asks nothing when there are no tabs to open", async () => {
    const runtime: FakeRuntime = new FakeRuntime();
    const client: TerminalRuntimeClient = new TerminalRuntimeClient(runtime.context);

    await client.openTabsAsync([]);
    expect(runtime.context.requests).toEqual([]);
    await client.openTabsAsync(["gone"]);

    expect(runtime.context.opened.map(t => [t.instance, t.title, t.options])).toEqual([["gone", "Terminal", { icon: "terminal" }]]);
    expect(runtime.context.logs).toEqual([]);
  });

  it("titles the tabs it opened plain while the runtime couldn't list its terminals once a listing succeeds, but one with no shell name, and logs each failed listing", async () => {
    const runtime: FakeRuntime = new FakeRuntime();
    const client: TerminalRuntimeClient = new TerminalRuntimeClient(runtime.context);
    runtime.addSession("s1", "bash", "/work");
    runtime.addSession("s2", "fish", "/work");
    runtime.addSession("s3", "zsh", "/work");
    runtime.sessionsFailure = new Error("The runtime is busy.");
    await client.openTabsAsync(["s1", "s2"]);
    await client.nameTabsAsync();
    expect(runtime.context.updates).toEqual([]);
    runtime.sessionsFailure = null;

    await client.openTabsAsync(["s3"]);

    expect(runtime.context.opened.map(t => [t.instance, t.title])).toEqual([["s1", "Terminal"], ["s2", "Terminal"], ["s3", "Zsh"]]);
    expect(runtime.context.updates).toEqual([["s1", { title: "Bash", icon: "attach_money" }]]);
    expect(runtime.context.logs).toEqual(["The terminal tabs show no shell names, since the terminals could not be listed: The runtime is busy.",
      "The terminal tabs show no shell names, since the terminals could not be listed: The runtime is busy."]);
  });

  it("titles the tabs it opened plain when asked once the runtime lists its terminals, and asks nothing while every tab has its name", async () => {
    const runtime: FakeRuntime = new FakeRuntime();
    const client: TerminalRuntimeClient = new TerminalRuntimeClient(runtime.context);
    runtime.addSession("s1", "zsh", "/work");
    await client.nameTabsAsync();
    expect(runtime.context.requests).toEqual([]);
    runtime.sessionsFailure = new Error("The runtime is busy.");
    await client.openTabsAsync(["s1"]);
    runtime.sessionsFailure = null;

    await client.nameTabsAsync();
    await client.nameTabsAsync();

    expect(runtime.context.updates).toEqual([["s1", { title: "Zsh", icon: "percent" }]]);
    expect(runtime.context.sent(TerminalNames.sessionsMethod)).toHaveLength(2);
  });

  it("titles a tab another client of the window opened plain, but none of another window's", async () => {
    const runtime: FakeRuntime = new FakeRuntime();
    const other: FakeRuntime = new FakeRuntime();
    runtime.addSession("s1", "zsh", "/work");
    other.addSession("s2", "bash", "/work");
    runtime.sessionsFailure = new Error("The runtime is busy.");
    other.sessionsFailure = new Error("The runtime is busy.");
    await new TerminalRuntimeClient(runtime.context).openTabsAsync(["s1"]);
    await new TerminalRuntimeClient(other.context).openTabsAsync(["s2"]);
    runtime.sessionsFailure = null;
    other.sessionsFailure = null;

    await new TerminalRuntimeClient(runtime.context).nameTabsAsync();

    expect([runtime.context.updates, other.context.updates]).toEqual([[["s1", { title: "Zsh", icon: "percent" }]], []]);
  });

  it("opens a renamed terminal's tab with the person's name over the app's title and the shell's name, and keeps an app's title for a tab opened again", async () => {
    const runtime: FakeRuntime = new FakeRuntime();
    const client: TerminalRuntimeClient = new TerminalRuntimeClient(runtime.context);
    runtime.addSession("s1", "bash", "/work", null, false, false, null, true, "Server");
    runtime.addSession("s2", "bash", "/work", null, false, false, null, true, "Build");
    runtime.addSession("s3", "bash", "/work");

    await client.openTabsAsync(["s1"]);
    await client.openTabsAsync(["s2", "s3"], null, () => true, true, "Sign in");
    await client.openTabsAsync(["s3"]);

    expect(runtime.context.opened.map(t => [t.instance, t.title, t.options])).toEqual([
      ["s1", "Server", { icon: "attach_money" }], ["s2", "Build", { icon: "attach_money" }], ["s3", "Sign in", { icon: "attach_money" }],
      ["s3", "Sign in", { icon: "attach_money" }]
    ]);
  });

  it("titles a renamed tab opened plain while the terminals couldn't be listed with the person's name once they can", async () => {
    const runtime: FakeRuntime = new FakeRuntime();
    const client: TerminalRuntimeClient = new TerminalRuntimeClient(runtime.context);
    runtime.addSession("s1", "gone", "/work", null, false, false, null, true, "Server");
    runtime.sessionsFailure = new Error("The runtime is busy.");
    await client.openTabsAsync(["s1"]);
    runtime.sessionsFailure = null;

    await client.nameTabsAsync();

    expect(runtime.context.opened.map(t => t.title)).toEqual(["Terminal"]);
    expect(runtime.context.updates).toEqual([["s1", { title: "Server", icon: "terminal" }]]);
  });

  it("sends the name the person typed, trimmed and cut to 4096 characters without splitting a character, and nothing left as no name", async () => {
    const runtime: FakeRuntime = new FakeRuntime();
    const client: TerminalRuntimeClient = new TerminalRuntimeClient(runtime.context);
    runtime.addSession("s1", "bash", "/work");

    await client.renameAsync("s1", "  Server  ");
    await client.renameAsync("s1", " 	 ");
    await client.renameAsync("s1", ` ${"n".repeat(4095)} x`);
    await client.renameAsync("s1", `${"n".repeat(4095)}\u{1f600}`);

    expect(runtime.context.sent(TerminalNames.renameMethod)).toEqual([
      { sessionId: "s1", name: "Server" }, { sessionId: "s1", name: null }, { sessionId: "s1", name: "n".repeat(4095) },
      { sessionId: "s1", name: "n".repeat(4095) }
    ]);
  });

  it("retitles a renamed tab with its name, and a cleared one with the app's title, else the shell's name and icon, else as a plain tab", async () => {
    const runtime: FakeRuntime = new FakeRuntime();
    const client: TerminalRuntimeClient = new TerminalRuntimeClient(runtime.context);
    runtime.addSession("s1", "bash", "/work");
    runtime.addSession("s2", "bash", "/work");
    runtime.addSession("s3", "gone", "/work");
    await client.openTabsAsync(["s2"], null, () => true, true, "Sign in");

    for (const name of [new TerminalName("s1", "Server"), new TerminalName("s1", null), new TerminalName("s2", null), new TerminalName("s3", null)])
      await client.retitleAsync(name);

    expect(runtime.context.updates).toEqual([
      ["s1", { title: "Server" }], ["s1", { title: "Bash", icon: "attach_money" }], ["s2", { title: "Sign in" }], ["s3", { title: "Terminal", icon: "terminal" }]
    ]);
  });

  it("retitles a cleared tab as a plain tab while the terminals can't be listed, and logs it, and with its shell's name at the next listing", async () => {
    const runtime: FakeRuntime = new FakeRuntime();
    const client: TerminalRuntimeClient = new TerminalRuntimeClient(runtime.context);
    runtime.addSession("s1", "bash", "/work");
    runtime.sessionsFailure = new Error("The runtime is busy.");

    await client.retitleAsync(new TerminalName("s1", null));
    runtime.sessionsFailure = null;
    await client.nameTabsAsync();

    expect(runtime.context.updates).toEqual([["s1", { title: "Terminal", icon: "terminal" }], ["s1", { title: "Bash", icon: "attach_money" }]]);
    expect(runtime.context.logs).toEqual(["The terminal tabs show no shell names, since the terminals could not be listed: The runtime is busy."]);
  });

  it("keeps a later rename's title over a cleared one still waiting for the terminals to be listed", async () => {
    const runtime: FakeRuntime = new FakeRuntime();
    const client: TerminalRuntimeClient = new TerminalRuntimeClient(runtime.context);
    runtime.addSession("s1", "bash", "/work");
    const listing: HeldAnswer = runtime.holdListings();

    const clearing: Promise<void> = client.retitleAsync(new TerminalName("s1", null));
    await client.retitleAsync(new TerminalName("s1", "Build"));
    listing.resolve(null);
    await clearing;

    expect(runtime.context.updates).toEqual([["s1", { title: "Build" }]]);
  });

  it("titles a cleared tab with the name a later rename gave meanwhile, else an app's title given meanwhile, once the terminals are listed", async () => {
    const runtime: FakeRuntime = new FakeRuntime();
    const client: TerminalRuntimeClient = new TerminalRuntimeClient(runtime.context);
    runtime.addSession("s1", "bash", "/work", null, false, false, null, true, "Build");
    runtime.addSession("s2", "bash", "/work");
    const listing: HeldAnswer = runtime.holdListings(t => t <= 2);

    const clearing: Promise<void[]> = Promise.all([client.retitleAsync(new TerminalName("s1", null)), client.retitleAsync(new TerminalName("s2", null))]);
    await client.openTabsAsync(["s2"], null, () => true, true, "Sign in");
    expect(runtime.context.updates).toEqual([]);
    listing.resolve(null);
    await clearing;

    expect(runtime.context.updates).toHaveLength(2);
    expect(new Map(runtime.context.updates)).toEqual(new Map([["s1", { title: "Build", icon: "attach_money" }], ["s2", { title: "Sign in", icon: "attach_money" }]]));
  });

  it("forgets an app's title for a tab whose terminal the person closed", async () => {
    const runtime: FakeRuntime = new FakeRuntime();
    const client: TerminalRuntimeClient = new TerminalRuntimeClient(runtime.context);
    runtime.addSession("s1", "bash", "/work");
    await client.openTabsAsync(["s1"], null, () => true, true, "Sign in");

    await client.closeAsync("s1");
    await client.retitleAsync(new TerminalName("s1", null));

    expect(runtime.context.updates.at(-1)).toEqual(["s1", { title: "Bash", icon: "attach_money" }]);
  });
});
