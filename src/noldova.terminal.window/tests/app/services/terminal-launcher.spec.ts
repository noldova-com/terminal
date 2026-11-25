/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonValue } from "@noldova/context.json";
import { EndedBy, TerminalCommandEnded, TerminalExited, TerminalLaunchParams, TerminalNames, TerminalReference, TerminalShellKind } from "@noldova/terminal.protocol";
import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from "vitest";

import { LaunchArgumentRefusedException } from "../../../src/app/exceptions/launch-argument-refused.exception.ts";
import { LaunchFolderMissingException } from "../../../src/app/exceptions/launch-folder-missing.exception.ts";
import { LaunchPartInactiveException } from "../../../src/app/exceptions/launch-part-inactive.exception.ts";
import { LaunchRowsRefusedException } from "../../../src/app/exceptions/launch-rows-refused.exception.ts";
import { LaunchRowsWithoutTabException } from "../../../src/app/exceptions/launch-rows-without-tab.exception.ts";
import { LaunchTitleRefusedException } from "../../../src/app/exceptions/launch-title-refused.exception.ts";
import { TerminalLaunchRefusedException } from "../../../src/app/exceptions/terminal-launch-refused.exception.ts";
import { LaunchedTerminal } from "../../../src/app/models/launched-terminal.ts";
import { TerminalEnd } from "../../../src/app/models/terminal-end.ts";
import { TerminalLaunch } from "../../../src/app/models/terminal-launch.ts";
import { TerminalDockGrowths } from "../../../src/app/services/terminal-dock-growths.ts";
import { TerminalLaunchEnds } from "../../../src/app/services/terminal-launch-ends.ts";
import { TerminalLauncher } from "../../../src/app/services/terminal-launcher.ts";
import { TerminalPart } from "../../../src/app/services/terminal-part.ts";
import { TerminalStartFolder } from "../../../src/app/services/terminal-start-folder.ts";
import { Resources } from "../../../src/resources.ts";
import { FakeRuntime } from "../../fixtures/fake-runtime.fixture.ts";
import { HeldAnswer } from "../../fixtures/held-answer.fixture.ts";
import { SpecWait } from "../../fixtures/spec-wait.fixture.ts";
import { OpenedTab } from "../../fixtures/terminal-part-context.fixture.ts";

async function rejectionAsync<T extends Error>(promise: Promise<unknown>, type: abstract new (...args: never[]) => T): Promise<T> {
  const caught: unknown = await promise.then(() => undefined, (error: unknown) => error);
  if (!(caught instanceof type))
    throw new Error(`Expected a ${type.name}, not ${String(caught)}.`);
  return caught;
}

class RefusalCase {
  public readonly what: string;
  public readonly type: abstract new (...args: never[]) => TerminalLaunchRefusedException;
  public readonly launch: TerminalLaunch;
  public readonly parameter: string;
  public readonly message: string;

  public constructor(what: string, type: abstract new (...args: never[]) => TerminalLaunchRefusedException, launch: TerminalLaunch, parameter: string, message: string) {
    this.what = what;
    this.type = type;
    this.launch = launch;
    this.parameter = parameter;
    this.message = message;
  }
}

describe("TerminalLauncher", () => {
  let app: FakeRuntime;
  let part: FakeRuntime;
  let stopServing: () => void;

  beforeEach(() => {
    app = new FakeRuntime();
    part = new FakeRuntime();
    stopServing = TerminalPart.serve(part.context);
  });

  afterEach(() => {
    TerminalLaunchEnds.detachAll();
    stopServing();
  });

  it("launches through the app's context with its variables and notice, and opens the titled tab through the terminal part's own", async () => {
    const launched: LaunchedTerminal = await TerminalLauncher.openAsync(app.context,
      new TerminalLaunch("/work", { API_URL: "https://example.com", TOKEN: "secret-value" }, "Run login to sign in.", "Sign in"));

    expect(launched.sessionId).toBe("launched-1");
    expect(app.context.sent(TerminalNames.launchMethod)).toEqual([{ shellId: null, folder: "/work", size: { cols: 80, rows: 24 },
      storedLimit: 104_857_600, environment: { API_URL: "https://example.com", TOKEN: "secret-value" }, notice: "Run login to sign in.", command: null, opensTab: true }]);
    expect(part.context.opened).toEqual([new OpenedTab("terminal.session", "launched-1", "Sign in", { icon: Resources.panelIcon })]);
    expect(app.context.opened).toEqual([]);
    expect([...app.context.logs, ...part.context.logs].join("\n")).not.toContain("secret-value");
  });

  it("opens no tab when the terminal part stops while the runtime launches, and still gives the launched terminal", async () => {
    const launchAsync: ((parameters: JsonValue) => Promise<JsonValue>) | undefined = app.context.handlers.get(TerminalNames.launchMethod);
    const answer: HeldAnswer = new HeldAnswer();
    app.context.handlers.set(TerminalNames.launchMethod, async t => {
      await answer.promise;
      return launchAsync?.(t) ?? null;
    });

    const opening: Promise<LaunchedTerminal> = TerminalLauncher.openAsync(app.context, new TerminalLaunch("/work"));
    await vi.waitFor(() => expect(app.context.sent(TerminalNames.launchMethod).length).toBe(1), { timeout: SpecWait.milliseconds });
    stopServing();
    answer.resolve(null);
    const launched: LaunchedTerminal = await opening;

    expect(launched.sessionId).toBe("launched-1");
    expect(part.context.opened).toEqual([]);
  });

  it("opens no tab for a launch that asks for none, and closes that terminal through the runtime alone", async () => {
    app.context.handlers.set(TerminalNames.closeMethod, async t => {
      app.exitSession(TerminalReference.fromJson(t).sessionId, null, EndedBy.Close);
      return null;
    });
    const launched: LaunchedTerminal = await TerminalLauncher.openAsync(app.context,
      new TerminalLaunch("/work", {}, null, "Sign in", "agent login", false));

    const sent: readonly JsonValue[] = app.context.sent(TerminalNames.launchMethod);
    await launched.closeAsync();

    expect([launched.sessionId, sent.map(t => TerminalLaunchParams.fromJson(t).opensTab), part.context.opened, app.context.opened])
      .toEqual(["launched-1", [false], [], []]);
    expect(part.context.closed).toEqual([]);
    expect(app.context.sent(TerminalNames.closeMethod)).toEqual([{ sessionId: "launched-1" }]);
    expect(await launched.ended).toEqual(new TerminalEnd("Close", null));
  });

  it("launches in the app's start folder, with no variables or notice, titled with its shell, when the launch gives none", async () => {
    const unregister: () => void = TerminalStartFolder.provide(app.context, () => "/work/project");
    part.addSession("launched-1", "bash", "/work/project");
    try {
      await TerminalLauncher.openAsync(app.context, new TerminalLaunch(null));
    }
    finally {
      unregister();
    }

    expect(app.context.sent(TerminalNames.launchMethod)).toEqual([{ shellId: null, folder: "/work/project", size: { cols: 80, rows: 24 },
      storedLimit: 104_857_600, environment: {}, notice: null, command: null, opensTab: true }]);
    expect(part.context.opened.map(t => t.title)).toEqual(["Bash"]);
  });

  it("resolves ended once, with the shell's exit and its code, and ignores other terminals' ends and payloads it can't read", async () => {
    const launched: LaunchedTerminal = await TerminalLauncher.openAsync(app.context, new TerminalLaunch("/work"));

    app.exitSession("other", 1);
    app.context.emit(TerminalNames.exitedEvent, { sessionId: "launched-1" });
    app.exitSession("launched-1", 3);
    app.exitSession("launched-1", null, EndedBy.Close);
    TerminalLaunchEnds.detachAll();

    expect(await launched.ended).toEqual(new TerminalEnd("Exit", 3));
    expect(app.context.listenerCount(TerminalNames.exitedEvent)).toBe(0);
  });

  it("asks its tab's dock for the launch's minimum rows, and releases the growth when its terminal ends or closes", async () => {
    app.context.handlers.set(TerminalNames.closeMethod, async t => {
      app.exitSession(TerminalReference.fromJson(t).sessionId, null, EndedBy.Close);
      return null;
    });
    const events: string[] = [];
    const exited: LaunchedTerminal = await TerminalLauncher.openAsync(app.context, new TerminalLaunch("/work", {}, null, null, null, true, 16));
    const closed: LaunchedTerminal = await TerminalLauncher.openAsync(app.context, new TerminalLaunch("/work", {}, null, null, null, true, 30));
    const plain: LaunchedTerminal = await TerminalLauncher.openAsync(app.context, new TerminalLaunch("/work"));
    for (const launched of [exited, closed, plain])
      TerminalDockGrowths.grow(launched.sessionId, rows => {
        events.push(`${launched.sessionId} grown ${rows}`);
        return () => events.push(`${launched.sessionId} released`);
      });
    const grown: readonly string[] = [...events];

    app.exitSession(exited.sessionId, 0, EndedBy.Exit);
    await exited.ended;
    await closed.closeAsync();
    await closed.ended;

    expect(grown).toEqual(["launched-1 grown 16", "launched-2 grown 30"]);
    expect(events.slice(grown.length)).toEqual(["launched-1 released", "launched-2 released"]);
  });

  it("resolves ended as Close when its terminal closes, and as Detach when the runtime starts again", async () => {
    const closed: LaunchedTerminal = await TerminalLauncher.openAsync(app.context, new TerminalLaunch("/work"));
    const detached: LaunchedTerminal = await TerminalLauncher.openAsync(app.context, new TerminalLaunch("/work"));

    app.exitSession(closed.sessionId, null, EndedBy.Close);
    TerminalLaunchEnds.detachAll();

    expect(await closed.ended).toEqual(new TerminalEnd("Close", null));
    expect(await detached.ended).toEqual(new TerminalEnd("Detach", null));
    expect(app.context.listenerCount(TerminalNames.exitedEvent)).toBe(0);
  });

  it("hears an end that comes before the runtime's answer", async () => {
    app.holdOpens();
    const launching: Promise<LaunchedTerminal> = TerminalLauncher.openAsync(app.context, new TerminalLaunch("/work"));
    await expect.poll(() => app.context.sent(TerminalNames.launchMethod).length, { timeout: SpecWait.milliseconds }).toBe(1);

    app.exitSession("launched-1", 0);
    app.releaseOpens();

    expect(await (await launching).ended).toEqual(new TerminalEnd("Exit", 0));
    expect(app.context.listenerCount(TerminalNames.exitedEvent)).toBe(0);
  });

  it("resolves commandEnded once with the launch's command's exit code while its terminal stays open, and ignores other terminals' ends, later ones and payloads it can't read", async () => {
    const passed: LaunchedTerminal = await TerminalLauncher.openAsync(app.context, new TerminalLaunch("/work", {}, null, "Sign in", "tool auth login"));
    const failed: LaunchedTerminal = await TerminalLauncher.openAsync(app.context, new TerminalLaunch("/work", {}, null, null, "npm test"));
    let isEnded: boolean = false;
    void Promise.race([passed.ended, failed.ended]).then(() => {
      isEnded = true;
    });

    app.context.emit(TerminalNames.launchCommandEndedEvent, new TerminalCommandEnded("other", 7).toJson());
    app.context.emit(TerminalNames.launchCommandEndedEvent, { sessionId: "launched-1" });
    app.context.emit(TerminalNames.launchCommandEndedEvent, new TerminalCommandEnded("launched-1", 0).toJson());
    app.context.emit(TerminalNames.launchCommandEndedEvent, new TerminalCommandEnded("launched-1", 2).toJson());
    app.context.emit(TerminalNames.launchCommandEndedEvent, new TerminalCommandEnded("launched-2", 1).toJson());

    expect([await passed.commandEnded, await failed.commandEnded, isEnded]).toEqual([0, 1, false]);
    expect(app.context.listenerCount(TerminalNames.launchCommandEndedEvent)).toBe(0);
  });

  it("logs an end and a command's end it can't read, and keeps waiting for its terminal's own", async () => {
    const launched: LaunchedTerminal = await TerminalLauncher.openAsync(app.context, new TerminalLaunch("/work", {}, null, null, "npm test"));

    app.context.emit(TerminalNames.exitedEvent, { sessionId: 5 });
    app.context.emit(TerminalNames.launchCommandEndedEvent, { sessionId: 5 });
    app.exitSession(launched.sessionId, 0);

    expect([await launched.commandEnded, await launched.ended]).toEqual([null, new TerminalEnd("Exit", 0)]);
    expect(app.context.logs).toEqual([
      expect.stringMatching(/^The window dropped a terminal\.exited event it could not read: \$/u),
      expect.stringMatching(/^The window dropped a terminal\.launchCommandEnded event it could not read: \$/u)
    ]);
  });

  it("passes on a failure to read an end or a command's end that isn't the payload's, and logs none", async () => {
    await TerminalLauncher.openAsync(app.context, new TerminalLaunch("/work", {}, null, null, "npm test"));
    const failure: Error = new Error("The reader broke.");
    const exited: MockInstance<typeof TerminalExited.fromJson> = vi.spyOn(TerminalExited, "fromJson").mockImplementation(() => {
      throw failure;
    });
    const commandEnded: MockInstance<typeof TerminalCommandEnded.fromJson> = vi.spyOn(TerminalCommandEnded, "fromJson").mockImplementation(() => {
      throw failure;
    });
    try {
      expect(() => app.context.emit(TerminalNames.exitedEvent, {})).toThrow(failure);
      expect(() => app.context.emit(TerminalNames.launchCommandEndedEvent, {})).toThrow(failure);
    }
    finally {
      exited.mockRestore();
      commandEnded.mockRestore();
    }

    expect(app.context.logs).toEqual([]);
  });

  it("resolves commandEnded without a code when the runtime can't tell it, its terminal closes or the runtime starts again first, or the launch has no command", async () => {
    const untold: LaunchedTerminal = await TerminalLauncher.openAsync(app.context, new TerminalLaunch("/work", {}, null, null, "winget install Tool"));
    const closed: LaunchedTerminal = await TerminalLauncher.openAsync(app.context, new TerminalLaunch("/work", {}, null, null, "npm test"));
    const detached: LaunchedTerminal = await TerminalLauncher.openAsync(app.context, new TerminalLaunch("/work", {}, null, null, "npm test"));
    const plain: LaunchedTerminal = await TerminalLauncher.openAsync(app.context, new TerminalLaunch("/work"));
    const plainCode: number | null = await plain.commandEnded;

    app.context.emit(TerminalNames.launchCommandEndedEvent, new TerminalCommandEnded(untold.sessionId, null).toJson());
    app.exitSession(closed.sessionId, null, EndedBy.Close);
    TerminalLaunchEnds.detachAll();

    expect([await untold.commandEnded, await closed.commandEnded, await detached.commandEnded, plainCode]).toEqual([null, null, null, null]);
    expect(app.context.listenerCount(TerminalNames.launchCommandEndedEvent)).toBe(0);
    expect(await new LaunchedTerminal("session-1", Promise.resolve(new TerminalEnd("Exit", 0))).commandEnded).toBeNull();
  });

  it("hears a command's end that comes before the runtime's answer", async () => {
    app.holdOpens();
    const launching: Promise<LaunchedTerminal> = TerminalLauncher.openAsync(app.context, new TerminalLaunch("/work", {}, null, null, "npm test"));
    await expect.poll(() => app.context.sent(TerminalNames.launchMethod).length, { timeout: SpecWait.milliseconds }).toBe(1);

    app.context.emit(TerminalNames.launchCommandEndedEvent, new TerminalCommandEnded("launched-1", 1).toJson());
    app.exitSession("launched-1", 0);
    app.releaseOpens();

    expect(await (await launching).commandEnded).toBe(1);
  });

  it("passes the launch's command to the runtime, which types it once the shell is ready", async () => {
    await TerminalLauncher.openAsync(app.context,
      new TerminalLaunch("/work", {}, null, "Install the tool", "curl -fsSL https://example.com/install.sh | bash"));

    expect(app.context.sent(TerminalNames.launchMethod)).toEqual([{ shellId: null, folder: "/work", size: { cols: 80, rows: 24 },
      storedLimit: 104_857_600, environment: {}, notice: null, command: "curl -fsSL https://example.com/install.sh | bash", opensTab: true }]);
    expect(part.context.opened.map(t => t.title)).toEqual(["Install the tool"]);
  });

  it("passes the shell kinds a launch asks for to the runtime, so a sign-in runs one of them whatever the Default shell is", async () => {
    await TerminalLauncher.openAsync(app.context, new TerminalLaunch("/work", {}, null, "Sign in", "tool auth login", true, null,
      [TerminalShellKind.PowerShell, TerminalShellKind.CommandPrompt]));

    expect(app.context.sent(TerminalNames.launchMethod)).toEqual([{ shellId: null, folder: "/work", size: { cols: 80, rows: 24 },
      storedLimit: 104_857_600, environment: {}, notice: null, command: "tool auth login", opensTab: true, shellKinds: ["PowerShell", "CommandPrompt"] }]);
    expect(new TerminalLaunch(null).shellKinds).toEqual([]);
  });

  it("closes a launched terminal's tab and ends it as closing the tab does, so its end is Close", async () => {
    app.context.handlers.set(TerminalNames.closeMethod, async t => {
      app.exitSession(TerminalReference.fromJson(t).sessionId, null, EndedBy.Close);
      return null;
    });
    const launched: LaunchedTerminal = await TerminalLauncher.openAsync(app.context, new TerminalLaunch("/work", {}, null, "Sign in", "agent login"));

    await launched.closeAsync();

    expect(part.context.closed).toEqual(["launched-1"]);
    expect(app.context.sent(TerminalNames.closeMethod)).toEqual([{ sessionId: "launched-1" }]);
    expect(await launched.ended).toEqual(new TerminalEnd("Close", null));
  });

  it("closes a launched terminal once when it is asked to close again before the first close ends", async () => {
    app.context.handlers.set(TerminalNames.closeMethod, async t => {
      const sessionId: string = TerminalReference.fromJson(t).sessionId;
      const index: number = app.sessions.findIndex(u => u.sessionId === sessionId);
      if (index < 0)
        throw new Error(`The session ${sessionId} was not found.`);
      app.sessions.splice(index, 1);
      app.exitSession(sessionId, null, EndedBy.Close);
      return null;
    });
    const launched: LaunchedTerminal = await TerminalLauncher.openAsync(app.context, new TerminalLaunch("/work"));

    await Promise.all([launched.closeAsync(), launched.closeAsync()]);

    expect(app.context.sent(TerminalNames.closeMethod)).toEqual([{ sessionId: "launched-1" }]);
    expect(await launched.ended).toEqual(new TerminalEnd("Close", null));
  });

  it("has closed a launched terminal the runtime no longer has when it refuses the close, as when the person closed the tab, and passes on any other refusal", async () => {
    const refusal: Error = new Error("The runtime is busy.");
    app.context.handlers.set(TerminalNames.closeMethod, async t => {
      const sessionId: string = TerminalReference.fromJson(t).sessionId;
      if (sessionId === "launched-2")
        throw refusal;
      app.sessions.splice(app.sessions.findIndex(u => u.sessionId === sessionId), 1);
      app.exitSession(sessionId, null, EndedBy.Close);
      throw new Error(`The session ${sessionId} was not found.`);
    });
    const gone: LaunchedTerminal = await TerminalLauncher.openAsync(app.context, new TerminalLaunch("/work"));
    const kept: LaunchedTerminal = await TerminalLauncher.openAsync(app.context, new TerminalLaunch("/work"));

    await gone.closeAsync();

    await expect(kept.closeAsync()).rejects.toBe(refusal);
    expect(await gone.ended).toEqual(new TerminalEnd("Close", null));
    expect(app.sessions.map(t => t.sessionId)).toEqual(["launched-2"]);
  });

  it("closes nothing for a launched terminal that already ended, nor for one made without a close", async () => {
    const launched: LaunchedTerminal = await TerminalLauncher.openAsync(app.context, new TerminalLaunch("/work"));
    app.exitSession("launched-1", 0);
    await launched.ended;

    await launched.closeAsync();
    await new LaunchedTerminal("session-1", new Promise<TerminalEnd>(() => undefined)).closeAsync();

    expect([part.context.closed, app.context.sent(TerminalNames.closeMethod)]).toEqual([[], []]);
  });

  it("refuses a folder that no longer exists, naming it, and opens no tab", async () => {
    app.missingFolders.add("/gone");

    const refusal: LaunchFolderMissingException = await rejectionAsync(TerminalLauncher.openAsync(app.context, new TerminalLaunch("/gone", {}, null, null, "npm test")),
      LaunchFolderMissingException);

    expect([refusal.parameter, refusal.folder, refusal.message]).toEqual(["folder", "/gone", "The terminal wasn't launched, and nothing opened: folder /gone doesn't exist."]);
    expect(part.context.opened).toEqual([]);
    expect([app.context.listenerCount(TerminalNames.exitedEvent), app.context.listenerCount(TerminalNames.launchCommandEndedEvent)]).toEqual([0, 0]);
  });

  it("passes on a launch the runtime fails, and stops listening", async () => {
    app.openFailure = new Error("The runtime is gone.");

    await expect(TerminalLauncher.openAsync(app.context, new TerminalLaunch("/work", {}, null, null, "npm test"))).rejects.toThrow("The runtime is gone.");
    expect(part.context.opened).toEqual([]);
    expect([app.context.listenerCount(TerminalNames.exitedEvent), app.context.listenerCount(TerminalNames.launchCommandEndedEvent)]).toEqual([0, 0]);
  });

  for (const { what, type, launch, parameter, message } of [
    new RefusalCase("a relative folder", LaunchArgumentRefusedException, new TerminalLaunch("work"), "folder", "folder must be an absolute path."),
    new RefusalCase("TERM", LaunchArgumentRefusedException, new TerminalLaunch("/work", { TERM: "secret-value" }), "environment.TERM", "environment.TERM is set by the terminal itself, so it can't be given."),
    new RefusalCase("COLORTERM", LaunchArgumentRefusedException, new TerminalLaunch("/work", { colorterm: "secret-value" }), "environment.colorterm",
      "environment.colorterm is set by the terminal itself, so it can't be given."),
    new RefusalCase("ZDOTDIR", LaunchArgumentRefusedException, new TerminalLaunch("/work", { ZDOTDIR: "secret-value" }), "environment.ZDOTDIR", "environment.ZDOTDIR is set by the terminal itself, so it can't be given."),
    new RefusalCase("a NOLDOVA_TERMINAL_ name", LaunchArgumentRefusedException, new TerminalLaunch("/work", { NOLDOVA_TERMINAL_NONCE: "secret-value" }), "environment.NOLDOVA_TERMINAL_NONCE",
      "environment.NOLDOVA_TERMINAL_NONCE is set by the terminal itself, so it can't be given."),
    new RefusalCase("a name that isn't portable", LaunchArgumentRefusedException, new TerminalLaunch("/work", { "A-B": "secret-value" }), "environment",
      "environment holds a name that isn't a portable variable name: a letter or _, then letters, digits or _."),
    new RefusalCase("names and values too long in all", LaunchArgumentRefusedException, new TerminalLaunch("/work", { A: "secret-value".repeat(2_730), B: "secret-value".repeat(2_730),
      C: "secret-value".repeat(2_730), D: "secret-value".repeat(2_730), E: "secret-value".repeat(3) }), "environment",
      "environment must have at most 131072 characters of names and values in all."),
    new RefusalCase("a blank notice", LaunchArgumentRefusedException, new TerminalLaunch("/work", {}, " "), "notice", "notice must not be blank."),
    new RefusalCase("a blank title", LaunchTitleRefusedException, new TerminalLaunch("/work", {}, null, " "), "title", "title must not be blank and must have at most 200 characters."),
    new RefusalCase("an over-long title", LaunchTitleRefusedException, new TerminalLaunch("/work", {}, null, "t".repeat(201)), "title", "title must not be blank and must have at most 200 characters."),
    new RefusalCase("a blank command", LaunchArgumentRefusedException, new TerminalLaunch("/work", {}, null, null, " "), "command", "command must not be blank."),
    new RefusalCase("a command of two lines", LaunchArgumentRefusedException, new TerminalLaunch("/work", {}, null, null, "npm install\nnpm test"), "command",
      "command must not hold a control character, such as a line break, since the terminal types it as one line and enters it."),
    new RefusalCase("no minimum rows", LaunchRowsRefusedException, new TerminalLaunch("/work", {}, null, null, null, true, 0), "minimumRows", "minimumRows must be a whole number from 1 to 100."),
    new RefusalCase("a part of a row", LaunchRowsRefusedException, new TerminalLaunch("/work", {}, null, null, null, true, 1.5), "minimumRows", "minimumRows must be a whole number from 1 to 100."),
    new RefusalCase("more rows than a terminal takes", LaunchRowsRefusedException, new TerminalLaunch("/work", {}, null, null, null, true, 101), "minimumRows",
      "minimumRows must be a whole number from 1 to 100."),
    new RefusalCase("rows that aren't a number", LaunchRowsRefusedException, new TerminalLaunch("/work", {}, null, null, null, true, Number.NaN), "minimumRows",
      "minimumRows must be a whole number from 1 to 100."),
    new RefusalCase("minimum rows without a tab", LaunchRowsWithoutTabException, new TerminalLaunch("/work", {}, null, null, null, false, 16), "minimumRows",
      "minimumRows needs the launch's tab; an embedded terminal takes its rows from EmbeddedTerminal.open."),
    new RefusalCase("a shell kind that isn't one", LaunchArgumentRefusedException, new TerminalLaunch("/work", {}, null, null, null, true, null, [TerminalShellKind.Bash, "Tcsh" as TerminalShellKind]),
      "shellKinds.1", "shellKinds.1 must be one of PowerShell, CommandPrompt, Bash, Zsh, Fish, Wsl, Other.")
  ])
    it(`refuses ${what} before anything opens, never naming a value`, async () => {
      const refusal: TerminalLaunchRefusedException = await rejectionAsync(TerminalLauncher.openAsync(app.context, launch), type);

      expect(refusal.parameter).toBe(parameter);
      expect(refusal.message).toBe(`The terminal wasn't launched, and nothing opened: ${message}`);
      expect(refusal.message).not.toContain("secret-value");
      expect(refusal.message).not.toContain("(Parameter");
      expect(app.context.requests).toEqual([]);
      expect(app.context.listenerCount(TerminalNames.exitedEvent)).toBe(0);
    });

  it("refuses every launch while the terminal part isn't active, and keeps a later part's service when an earlier one stops", async () => {
    const later: FakeRuntime = new FakeRuntime();
    const stopLater: () => void = TerminalPart.serve(later.context);
    stopServing();
    await TerminalLauncher.openAsync(app.context, new TerminalLaunch("/work"));
    stopLater();

    expect(later.context.opened.map(t => t.instance)).toEqual(["launched-1"]);
    const refusal: LaunchPartInactiveException = await rejectionAsync(TerminalLauncher.openAsync(app.context, new TerminalLaunch("/work")), LaunchPartInactiveException);
    expect([refusal.parameter, refusal.message]).toEqual(["context", "The terminal wasn't launched, and nothing opened: the terminal's window part isn't active in this window."]);
    expect(app.context.sent(TerminalNames.launchMethod).length).toBe(1);
  });

  it("passes on an error that isn't a refusal", async () => {
    const unreadable: Record<string, string> = new Proxy<Record<string, string>>({}, {
      ownKeys: () => {
        throw new TypeError("The environment can't be read.");
      }
    });
    const launch: TerminalLaunch = new TerminalLaunch("/work", unreadable);

    await expect(TerminalLauncher.openAsync(app.context, launch)).rejects.toThrow(TypeError);
  });
});
