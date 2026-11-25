/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import type { IWindowPartContext } from "@noldova/desktop.window";
import { ArgumentException } from "@noldova/context.exceptions";
import type { JsonValue } from "@noldova/context.json";
import { ArgumentValidator, TerminalLine, TerminalNames,TerminalReference, TerminalRunBusy, TerminalRunEnded, TerminalRunEndedBy, TerminalRunOutcome, TerminalRunOutput, TerminalRunParams, TerminalRunResult, TerminalShellKind,
  TerminalTextRun } from "@noldova/terminal.protocol";
import { afterEach, describe, expect, it, type MockInstance, vi } from "vitest";

import { OwnersProvidedException } from "../../../src/app/exceptions/owners-provided.exception.ts";
import { RunArgumentRefusedException } from "../../../src/app/exceptions/run-argument-refused.exception.ts";
import { RunLinesRefusedException } from "../../../src/app/exceptions/run-lines-refused.exception.ts";
import { RunPartInactiveException } from "../../../src/app/exceptions/run-part-inactive.exception.ts";
import { RunShellKindsMissingException } from "../../../src/app/exceptions/run-shell-kinds-missing.exception.ts";
import { TerminalRunNotFoundException } from "../../../src/app/exceptions/terminal-run-not-found.exception.ts";
import { TerminalRunNotTypedException } from "../../../src/app/exceptions/terminal-run-not-typed.exception.ts";
import { TerminalRunRefusedException } from "../../../src/app/exceptions/terminal-run-refused.exception.ts";
import type { ITerminalFocusTarget } from "../../../src/app/interfaces/i-terminal-focus-target.ts";
import { TerminalRun } from "../../../src/app/models/terminal-run.ts";
import { TerminalRunEnd } from "../../../src/app/models/terminal-run-end.ts";
import { TerminalRunTarget } from "../../../src/app/models/terminal-run-target.ts";
import { TerminalFocus } from "../../../src/app/services/terminal-focus.ts";
import { TerminalOwners } from "../../../src/app/services/terminal-owners.ts";
import { TerminalPart } from "../../../src/app/services/terminal-part.ts";
import { TerminalRunEnds } from "../../../src/app/services/terminal-run-ends.ts";
import { TerminalStartFolder } from "../../../src/app/services/terminal-start-folder.ts";
import { TerminalWindowPart } from "../../../src/app/services/terminal-window-part.ts";
import { FakeRuntime } from "../../fixtures/fake-runtime.fixture.ts";
import { HeldAnswer } from "../../fixtures/held-answer.fixture.ts";
import { SpecWait } from "../../fixtures/spec-wait.fixture.ts";
import { TerminalPartContext } from "../../fixtures/terminal-part-context.fixture.ts";

async function rejectionAsync<T extends Error>(promise: Promise<unknown>, type: abstract new (...args: never[]) => T): Promise<T> {
  const caught: unknown = await promise.then(() => undefined, (error: unknown) => error);
  if (!(caught instanceof type))
    throw new Error(`Expected a ${type.name}, not ${String(caught)}.`);
  return caught;
}

describe("TerminalOwners", () => {
  const provided: TerminalOwners[] = [];
  let stopServing: () => void = () => undefined;

  afterEach(async () => {
    for (const owners of provided.splice(0))
      await owners.removeAsync();
    stopServing();
  });

  function provide(context: TerminalPartContext, newOwner: () => string | null = () => null,
    part: TerminalPartContext = context): TerminalOwners {
    stopServing = TerminalPart.serve(part);
    const owners: TerminalOwners = TerminalOwners.provide(context, newOwner);
    provided.push(owners);
    return owners;
  }

  function addTerminals(runtime: FakeRuntime): void {
    runtime.addSession("c42a", "bash", "/work", null, false, false, "example.chat/42");
    runtime.addSession("general", "bash", "/work");
    runtime.addSession("c7", "zsh", "/work", null, false, false, "example.chat/7");
    runtime.addSession("c42b", "zsh", "/work", null, false, false, "example.chat/42");
    runtime.addSession("agent", "bash", "/work", null, true);
    runtime.addSession("panel", "bash", "/work", null, false, true);
  }

  it("shows no owner and gives no new owner until an app provides one", () => {
    expect([TerminalOwners.shown, TerminalOwners.readNewOwner()]).toEqual([null, null]);
  });

  it("asks the provider for the new owner at each read", () => {
    let owner: string | null = "example.chat/42";
    provide(new TerminalPartContext(), () => owner);

    const first: string | null = TerminalOwners.readNewOwner();
    owner = null;

    expect([first, TerminalOwners.readNewOwner()]).toEqual(["example.chat/42", null]);
  });

  it("gives no new owner for a blank or over-long one, or when the provider throws, and says so in the providing app's log", () => {
    const context: TerminalPartContext = new TerminalPartContext();
    const owners: (() => string | null)[] = [() => " ", () => "o".repeat(257), () => {
      throw new Error("No chat is open.");
    }];
    let next: () => string | null = () => null;
    provide(context, () => next());

    const read: (string | null)[] = [];
    for (const owner of owners) {
      next = owner;
      read.push(TerminalOwners.readNewOwner());
    }

    expect(read).toEqual([null, null, null]);
    expect(context.logs).toEqual([
      "The terminal opened without an owner instead of the app's new owner: ArgumentException: The value must not be blank. (Parameter 'owner')",
      "The terminal opened without an owner instead of the app's new owner: ArgumentException: The value must have at most 256 characters. (Parameter 'owner')",
      "The terminal opened without an owner instead of the app's new owner: Error: No chat is open."
    ]);
  });

  it("refuses a second provider until the first is removed", async () => {
    const first: TerminalOwners = provide(new TerminalPartContext(), () => "example.chat/1");

    expect(() => TerminalOwners.provide(new TerminalPartContext(), () => "example.chat/2")).toThrow(OwnersProvidedException);
    await first.removeAsync();
    provide(new TerminalPartContext(), () => "example.chat/2");
    await first.removeAsync();

    expect(TerminalOwners.readNewOwner()).toBe("example.chat/2");
  });

  it("shows an owner's terminals in tabs, in the order they opened, and hides every other owner's, leaving the rest", async () => {
    const runtime: FakeRuntime = new FakeRuntime();
    addTerminals(runtime);
    const owners: TerminalOwners = provide(runtime.context);

    await owners.showAsync("example.chat/42");

    expect(TerminalOwners.shown).toBe("example.chat/42");
    expect(runtime.context.opened.map(t => [t.name, t.instance, t.title])).toEqual([["terminal.session", "c42a", "Bash"], ["terminal.session", "c42b", "Zsh"]]);
    expect(runtime.context.closed).toEqual(["c7"]);
    expect(runtime.context.sent(TerminalNames.closeMethod)).toEqual([]);
  });

  it("opens no tab, as it shows an owner, for a terminal a run opened without one, which stays listed", async () => {
    const runtime: FakeRuntime = new FakeRuntime();
    runtime.addSession("c42a", "bash", "/work", null, false, false, "example.chat/42", false);
    runtime.addSession("c42b", "zsh", "/work", null, false, false, "example.chat/42");
    const owners: TerminalOwners = provide(runtime.context);

    await owners.showAsync("example.chat/42");

    expect(runtime.context.opened.map(t => t.instance)).toEqual(["c42b"]);
    expect(runtime.sessions.map(t => [t.sessionId, t.opensTab])).toEqual([["c42a", false], ["c42b", true]]);
  });

  it("shows and hides an owner's tabs through the terminal part's context when the app's may open only its own module's views", async () => {
    const runtime: FakeRuntime = new FakeRuntime();
    runtime.context.moduleId = "terminal";
    addTerminals(runtime);
    const app: TerminalPartContext = new TerminalPartContext();
    app.moduleId = "example";
    for (const [method, handlerAsync] of runtime.context.handlers)
      app.handlers.set(method, handlerAsync);
    const owners: TerminalOwners = provide(app, () => null, runtime.context);

    await owners.showAsync("example.chat/42");
    await owners.showAsync("example.chat/7");

    expect(runtime.context.opened.map(t => t.instance)).toEqual(["c42a", "c42b", "c7"]);
    expect(runtime.context.closed).toEqual(["c7", "c42a", "c42b"]);
    expect([app.opened, app.closed, app.sent(TerminalNames.sessionsMethod).length]).toEqual([[], [], 2]);
  });

  it("only sets the owner and tells the runtime while the terminal part isn't active, and opens and closes no tab", async () => {
    const runtime: FakeRuntime = new FakeRuntime();
    addTerminals(runtime);
    const owners: TerminalOwners = provide(runtime.context);
    stopServing();

    await owners.showAsync("example.chat/42");

    expect(TerminalOwners.shown).toBe("example.chat/42");
    expect([runtime.context.opened, runtime.context.closed, runtime.context.requests.map(t => [t.method, t.parameters])]).toEqual([[], [],
      [[TerminalNames.showOwnerMethod, { owner: "example.chat/42", isHidden: false }]]]);
  });

  it("opens and closes no tab when the terminal part stops while the show lists the terminals", async () => {
    const runtime: FakeRuntime = new FakeRuntime();
    addTerminals(runtime);
    const owners: TerminalOwners = provide(runtime.context);
    const sessionsAsync: ((parameters: JsonValue) => Promise<JsonValue>) | undefined = runtime.context.handlers.get(TerminalNames.sessionsMethod);
    const listing: HeldAnswer = new HeldAnswer();
    runtime.context.handlers.set(TerminalNames.sessionsMethod, async t => {
      await listing.promise;
      return sessionsAsync?.(t) ?? null;
    });

    const showing: Promise<void> = owners.showAsync("example.chat/42");
    await vi.waitFor(() => expect(runtime.context.sent(TerminalNames.sessionsMethod).length).toBe(1), { timeout: SpecWait.milliseconds });
    stopServing();
    listing.resolve(null);
    await showing;

    expect(TerminalOwners.shown).toBe("example.chat/42");
    expect([runtime.context.opened, runtime.context.closed]).toEqual([[], []]);
  });

  it("opens no tab when the terminal part stops while the owner's tabs wait for the terminals to be listed", async () => {
    const runtime: FakeRuntime = new FakeRuntime();
    addTerminals(runtime);
    const listing: HeldAnswer = runtime.holdListings(t => t > 1);

    const showing: Promise<void> = provide(runtime.context).showAsync("example.chat/42");
    await vi.waitFor(() => expect(runtime.listingCount).toBe(2), { timeout: SpecWait.milliseconds });
    stopServing();
    listing.resolve(null);
    await showing;

    expect([runtime.context.opened, runtime.context.closed]).toEqual([[], ["c7"]]);
  });

  it("shows and hides an agent's terminal with its owner, as the person's, without ending its shell", async () => {
    const runtime: FakeRuntime = new FakeRuntime();
    addTerminals(runtime);
    runtime.addSession("agent42", "bash", "/work", null, true, false, "example.chat/42");
    const owners: TerminalOwners = provide(runtime.context);

    await owners.showAsync("example.chat/42");
    const shown: string[] = runtime.context.opened.map(t => t.instance);
    runtime.context.closed.splice(0);
    await owners.showAsync("example.chat/7");

    expect([shown, runtime.context.closed]).toEqual([["c42a", "c42b", "agent42"], ["c42a", "c42b", "agent42"]]);
    expect(runtime.context.sent(TerminalNames.closeMethod)).toEqual([]);
  });

  it("hides the shown owner's terminals when another shows, or none, without ending their shells, and reopens them when it shows again", async () => {
    const runtime: FakeRuntime = new FakeRuntime();
    addTerminals(runtime);
    const owners: TerminalOwners = provide(runtime.context);
    await owners.showAsync("example.chat/42");
    runtime.context.closed.splice(0);
    runtime.context.opened.splice(0);

    await owners.showAsync("example.chat/7");
    const afterSeven: string[] = runtime.context.closed.splice(0);
    await owners.showAsync(null);
    const afterNone: string[] = runtime.context.closed.splice(0);
    await owners.showAsync("example.chat/42");

    expect([afterSeven, afterNone, TerminalOwners.shown]).toEqual([["c42a", "c42b"], ["c42a", "c7", "c42b"], "example.chat/42"]);
    expect(runtime.context.opened.map(t => t.instance)).toEqual(["c7", "c42a", "c42b"]);
    expect(runtime.context.sent(TerminalNames.closeMethod)).toEqual([]);
  });

  it("tells the runtime each owner it shows, or none, once per change, and none once it is removed", async () => {
    const runtime: FakeRuntime = new FakeRuntime();
    addTerminals(runtime);
    const owners: TerminalOwners = provide(runtime.context);

    await owners.showAsync("example.chat/42");
    await owners.showAsync("example.chat/42");
    await owners.showAsync("example.chat/7");
    await owners.showAsync(null);
    await owners.showAsync("example.chat/42");
    await owners.removeAsync();

    expect(runtime.context.sent(TerminalNames.showOwnerMethod)).toEqual([{ owner: "example.chat/42", isHidden: false }, { owner: "example.chat/7", isHidden: false }, { owner: null, isHidden: false },
      { owner: "example.chat/42", isHidden: false }, { owner: null, isHidden: false }]);
  });

  it("tells the runtime it shows no owner while the window is hidden, so a run's shell starts at once, and the owner again once it shows", async () => {
    const runtime: FakeRuntime = new FakeRuntime();
    addTerminals(runtime);
    const owners: TerminalOwners = provide(runtime.context);
    const visibility: MockInstance<() => DocumentVisibilityState> = vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    try {
      await owners.showAsync("example.chat/42");
      visibility.mockReturnValue("visible");
      document.dispatchEvent(new Event("visibilitychange"));
      await owners.showAsync("example.chat/42");
      visibility.mockReturnValue("hidden");
      document.dispatchEvent(new Event("visibilitychange"));
      await owners.showAsync("example.chat/42");
      await owners.removeAsync();
      document.dispatchEvent(new Event("visibilitychange"));
      await owners.showAsync("example.chat/7");
    }
    finally {
      visibility.mockRestore();
    }

    expect([TerminalOwners.shown, runtime.context.sent(TerminalNames.showOwnerMethod)]).toEqual([null,
      [{ owner: null, isHidden: true }, { owner: "example.chat/42", isHidden: false }, { owner: null, isHidden: true }, { owner: null, isHidden: true }]]);
  });

  it("tells the runtime nothing for a window that hides or shows while its owners are being removed", async () => {
    const runtime: FakeRuntime = new FakeRuntime();
    const owners: TerminalOwners = provide(runtime.context);
    await owners.showAsync("example.chat/42");

    const removing: Promise<void> = owners.removeAsync();
    document.dispatchEvent(new Event("visibilitychange"));
    await removing;
    await owners.showAsync("example.chat/7");

    expect(runtime.context.sent(TerminalNames.showOwnerMethod)).toEqual([{ owner: "example.chat/42", isHidden: false }, { owner: null, isHidden: false }]);
  });

  it("logs an owner the runtime can't be told of, and still shows its tabs", async () => {
    const runtime: FakeRuntime = new FakeRuntime();
    addTerminals(runtime);
    runtime.context.handlers.set(TerminalNames.showOwnerMethod, () => Promise.reject(new Error("The runtime is gone.")));
    const owners: TerminalOwners = provide(runtime.context);

    await owners.showAsync("example.chat/42");

    expect([TerminalOwners.shown, runtime.context.opened.map(t => t.instance), runtime.context.logs]).toEqual(["example.chat/42", ["c42a", "c42b"],
      ["The runtime could not be told which owner's terminals this window shows: The runtime is gone."]]);
  });

  it("leaves the window alone when the shown owner shows again", async () => {
    const runtime: FakeRuntime = new FakeRuntime();
    addTerminals(runtime);
    const owners: TerminalOwners = provide(runtime.context);
    await owners.showAsync("example.chat/42");
    const requests: number = runtime.context.requests.length;

    await owners.showAsync("example.chat/42");

    expect([runtime.context.opened.length, runtime.context.closed.length, runtime.context.requests.length]).toEqual([2, 1, requests]);
  });

  it("shows the owners in the order asked, and one that fails leaves the window as it was", async () => {
    const runtime: FakeRuntime = new FakeRuntime();
    addTerminals(runtime);
    const owners: TerminalOwners = provide(runtime.context);
    const sessionsAsync: ((parameters: JsonValue) => Promise<JsonValue>) | undefined = runtime.context.handlers.get(TerminalNames.sessionsMethod);
    let fails: boolean = true;
    runtime.context.handlers.set(TerminalNames.sessionsMethod, async t => {
      if (fails) {
        fails = false;
        throw new Error("The runtime is busy.");
      }
      return sessionsAsync?.(t) ?? null;
    });

    const failing: Promise<void> = owners.showAsync("example.chat/7");
    const next: Promise<void> = owners.showAsync("example.chat/42");

    await expect(failing).rejects.toThrow("The runtime is busy.");
    await next;
    expect(TerminalOwners.shown).toBe("example.chat/42");
    expect(runtime.context.opened.map(t => t.instance)).toEqual(["c42a", "c42b"]);
  });

  it("refuses a blank or over-long owner to show or close", async () => {
    const runtime: FakeRuntime = new FakeRuntime();
    const owners: TerminalOwners = provide(runtime.context);

    expect(() => owners.showAsync(" ")).toThrow(ArgumentException);
    expect(() => owners.showAsync(" ")).toThrow("The value must not be blank. (Parameter 'owner')");
    expect(() => owners.showAsync("o".repeat(257))).toThrow(ArgumentException);
    expect(() => owners.showAsync("o".repeat(257))).toThrow("The value must have at most 256 characters. (Parameter 'owner')");
    const closing: Promise<void> = owners.closeAsync(" ");
    await expect(closing).rejects.toBeInstanceOf(ArgumentException);
    await expect(closing).rejects.toThrow("The value must not be blank. (Parameter 'owner')");
    expect(runtime.context.requests).toEqual([]);
  });

  it("asks the runtime to close an owner's terminals, whose tabs close when it says so", async () => {
    const runtime: FakeRuntime = new FakeRuntime();
    addTerminals(runtime);
    const owners: TerminalOwners = provide(runtime.context);

    await owners.closeAsync("example.chat/42");

    expect(runtime.context.sent(TerminalNames.closeOwnerMethod)).toEqual([{ owner: "example.chat/42" }]);
    expect(runtime.sessions.map(t => t.sessionId)).toEqual(["general", "c7", "agent", "panel"]);
  });

  it("hides every owned terminal when it is removed, and a removed one shows nothing", async () => {
    const runtime: FakeRuntime = new FakeRuntime();
    addTerminals(runtime);
    const owners: TerminalOwners = provide(runtime.context, () => "example.chat/42");
    await owners.showAsync("example.chat/42");
    runtime.context.closed.splice(0);

    await owners.removeAsync();
    await owners.showAsync("example.chat/7");

    expect([TerminalOwners.shown, TerminalOwners.readNewOwner()]).toEqual([null, null]);
    expect(runtime.context.closed).toEqual(["c42a", "c7", "c42b"]);
    expect(runtime.context.opened.map(t => t.instance)).toEqual(["c42a", "c42b"]);
  });

  it("lets another provider take the window when hiding fails at removal", async () => {
    const runtime: FakeRuntime = new FakeRuntime();
    addTerminals(runtime);
    const owners: TerminalOwners = provide(runtime.context, () => "example.chat/42");
    await owners.showAsync("example.chat/42");
    runtime.context.handlers.set(TerminalNames.sessionsMethod, () => Promise.reject(new Error("The runtime is gone.")));

    await expect(owners.removeAsync()).rejects.toThrow("The runtime is gone.");

    expect(() => provide(new TerminalPartContext(), () => "example.chat/7")).not.toThrow();
    expect(TerminalOwners.readNewOwner()).toBe("example.chat/7");
  });

  it("opens no tab for an owner's terminal the runtime closed while the owner's tabs waited for the terminals to be listed", async () => {
    const runtime: FakeRuntime = new FakeRuntime();
    addTerminals(runtime);
    const listing: HeldAnswer = runtime.holdListings(t => t > 1);

    const showing: Promise<void> = provide(runtime.context, () => null).showAsync("example.chat/42");
    await vi.waitFor(() => expect(runtime.listingCount).toBe(2), { timeout: SpecWait.milliseconds });
    runtime.context.emit(TerminalNames.closedEvent, { sessionId: "c42a" });
    listing.resolve(null);
    await showing;

    expect(runtime.context.opened.map(t => t.instance)).toEqual(["c42b"]);
  });

  describe("running commands", () => {
    const OWNER: string = "example.chat/42";
    const cleanups: (() => Promise<void> | void)[] = [];

    afterEach(async () => {
      for (const cleanupAsync of cleanups.splice(0).reverse())
        await cleanupAsync();
      const served: IWindowPartContext | null = TerminalPart.context;
      if (!Object.isNull(served))
        TerminalPart.serve(served)();
    });

    async function provideAsync(runtime: FakeRuntime): Promise<TerminalOwners> {
      TerminalRunEnds.detachAll();
      const part: TerminalWindowPart = new TerminalWindowPart();
      cleanups.push(() => part.deactivateAsync());
      await part.activateAsync(runtime.context);
      const owners: TerminalOwners = TerminalOwners.provide(runtime.context, () => null);
      cleanups.push(() => owners.removeAsync());
      await owners.showAsync(OWNER);
      return owners;
    }

    function runs(runtime: FakeRuntime): readonly unknown[] {
      return runtime.context.sent(TerminalNames.runMethod);
    }

    describe("canRun", () => {
      it("takes commands of one line or several, with tabs, up to the command limit", () => {
        expect(["npm test", "npm install\r\nnpm test\n", "for f in *; do\n\techo $f\ndone", "c".repeat(TerminalOwners.maximumCommandLength)]
          .map(t => TerminalOwners.canRun(t))).toEqual([true, true, true, true]);
        expect(TerminalOwners.maximumCommandLength).toBe(16_384);
      });

      it("refuses blank or over-long commands, and a control character other than a line break or a tab", () => {
        expect(["", " \n\t ", "c".repeat(16_385), "ls\u001b[A", "ls\rrm", "ls\u0000"].map(t => TerminalOwners.canRun(t)))
          .toEqual([false, false, false, false, false, false]);
      });

      it("refuses a format or default-ignorable character outside an emoji, which would make the commands read differently from what runs, and takes emoji", () => {
        expect(["ls # \u202erm", "ls\u2066rm\u2069", "ls\u200brm", "ls\u200frm", "ls\u061crm", "ls\u{e0041}rm", "ls\ufeffrm", "ls\u034frm",
          "ls\ufe0frm"].map(t => TerminalOwners.canRun(t))).toEqual([false, false, false, false, false, false, false, false, false]);
        expect(["echo \u{1f468}\u200d\u{1f469}\u200d\u{1f467}", "echo \u{1f3f4}\u{e0067}\u{e0062}\u{e0065}\u{e006e}\u{e0067}\u{e007f}"].map(t => TerminalOwners.canRun(t)))
          .toEqual([true, true]);
      });

      it("passes on a failure of the check that isn't a refusal of the commands", () => {
        const failure: Error = new Error("The check broke.");
        const requireScript: MockInstance<(name: string, value: string) => void> = vi.spyOn(ArgumentValidator, "requireScript").mockImplementation(() => {
          throw failure;
        });
        try {
          expect(() => TerminalOwners.canRun("npm test")).toThrow(failure);
        }
        finally {
          requireScript.mockRestore();
        }
      });
    });

    describe("runAsync", () => {
      it("runs the commands in the terminal the runtime picks, with the window's settings, and opens its tab while the owner shows", async () => {
        const runtime: FakeRuntime = new FakeRuntime();
        const owners: TerminalOwners = await provideAsync(runtime);

        const sessionId: string = await owners.runAsync(OWNER, "npm install\nnpm test\n", "/work", [TerminalShellKind.Bash, TerminalShellKind.Zsh]);

        expect(sessionId).toBe("run-1");
        expect(runs(runtime)).toEqual([{ owner: OWNER, command: "npm install\nnpm test\n", folder: "/work", shellKinds: ["Bash", "Zsh"], shellId: null,
          size: { cols: 80, rows: 24 }, storedLimit: 104_857_600, sessionId: null, whenBusy: "Refuse", opensTab: true }]);
        expect(runtime.context.opened.map(t => [t.name, t.instance])).toEqual([["terminal.session", "run-1"]]);
        expect(runtime.context.logs).toEqual([]);
      });

      it("shows the tab of a terminal already open and gives its pane the focus, without opening another tab", async () => {
        const runtime: FakeRuntime = new FakeRuntime();
        runtime.addSession("c42", "bash", "/work", null, false, false, OWNER);
        runtime.freeSessions.add("c42");
        const owners: TerminalOwners = await provideAsync(runtime);
        const opened: number = runtime.context.opened.length;
        const shown: string[] = [];
        const target: ITerminalFocusTarget = { contains: () => false, isFor: t => t === "c42", showAsync: async () => shown.push("c42") > 0, hideDock: () => undefined };
        cleanups.push(TerminalFocus.add(target));

        expect(await owners.runAsync(OWNER, "ls", null, [])).toBe("c42");

        expect([shown, runtime.context.opened.length - opened]).toEqual([["c42"], 0]);
      });

      it("starts a new terminal in the app's start folder for no folder, and sends the Default shell setting's shell, which the runtime takes only of the kinds", async () => {
        const runtime: FakeRuntime = new FakeRuntime();
        runtime.context.settings.set("terminal.defaultShell", "zsh");
        const owners: TerminalOwners = await provideAsync(runtime);
        cleanups.push(TerminalStartFolder.provide(runtime.context, () => "/work/project"));

        await owners.runAsync(OWNER, "Get-ChildItem", null, [TerminalShellKind.PowerShell]);

        expect(runs(runtime).map(t => [(t as { folder: string }).folder, (t as { shellId: string }).shellId])).toEqual([["/work/project", "zsh"]]);
      });

      it("runs for an owner the window doesn't show without a tab, which opens once that owner shows", async () => {
        const runtime: FakeRuntime = new FakeRuntime();
        const owners: TerminalOwners = await provideAsync(runtime);

        expect(await owners.runAsync("example.chat/7", "ls", "/work", [])).toBe("run-1");
        expect(runtime.context.opened).toEqual([]);
        await owners.showAsync("example.chat/7");

        expect(runtime.context.opened.map(t => t.instance)).toEqual(["run-1"]);
      });

      it("opens no tab when the terminal part stops, or the app shows another owner, while the runtime answers", async () => {
        const runtime: FakeRuntime = new FakeRuntime();
        const owners: TerminalOwners = await provideAsync(runtime);
        runtime.holdOpens();

        const hidden: Promise<string> = owners.runAsync(OWNER, "ls", "/work", []);
        await vi.waitFor(() => expect(runs(runtime)).toHaveLength(1), { timeout: SpecWait.milliseconds });
        const showing: Promise<void> = owners.showAsync("example.chat/7");
        runtime.releaseOpens();
        await Promise.all([hidden, showing]);
        runtime.holdOpens();
        const stopped: Promise<string> = owners.runAsync("example.chat/7", "ls", "/work", []);
        await vi.waitFor(() => expect(runs(runtime)).toHaveLength(2), { timeout: SpecWait.milliseconds });
        const served: IWindowPartContext | null = TerminalPart.context;
        if (!Object.isNull(served))
          TerminalPart.serve(served)();
        runtime.releaseOpens();

        expect([await hidden, await stopped]).toEqual(["run-1", "run-2"]);
        expect(runtime.context.opened).toEqual([]);
      });

      it("refuses before anything is sent while the terminal part isn't active, and for each argument the protocol refuses, never naming the commands", async () => {
        const runtime: FakeRuntime = new FakeRuntime();
        const inactive: TerminalOwners = TerminalOwners.provide(runtime.context, () => null);
        cleanups.push(() => inactive.removeAsync());
        const refusalAsync = async (run: Promise<string>, type: typeof RunPartInactiveException | typeof RunArgumentRefusedException = RunArgumentRefusedException):
          Promise<readonly [string, string]> => {
          const error: unknown = await run.catch((caught: unknown) => caught);
          expect(error).toBeInstanceOf(TerminalRunRefusedException);
          expect(error).toBeInstanceOf(type);
          return [(error as TerminalRunRefusedException).parameter, (error as TerminalRunRefusedException).message];
        };

        expect(await refusalAsync(inactive.runAsync(OWNER, "ls", null, []), RunPartInactiveException)).toEqual(["context",
          "The commands weren't run, and nothing opened: the terminal's window part isn't active in this window."]);
        const part: TerminalWindowPart = new TerminalWindowPart();
        cleanups.push(() => part.deactivateAsync());
        await part.activateAsync(runtime.context);
        const parameters: (readonly [string, string])[] = [
          await refusalAsync(inactive.runAsync(" ", "ls", null, [])),
          await refusalAsync(inactive.runAsync(OWNER, "rm -rf \u001b[A", null, [])),
          await refusalAsync(inactive.runAsync(OWNER, " \n ", null, [])),
          await refusalAsync(inactive.runAsync(OWNER, "ls", "work", [])),
          await refusalAsync(inactive.runAsync(OWNER, "ls", null, [TerminalShellKind.Bash, "Csh" as TerminalShellKind]))
        ];

        expect(parameters).toEqual([
          ["owner", "The commands weren't run, and nothing opened: owner must not be blank."],
          ["command", "The commands weren't run, and nothing opened: command must not hold a control character other than a line break or a tab."],
          ["command", "The commands weren't run, and nothing opened: command must not be blank."],
          ["folder", "The commands weren't run, and nothing opened: folder must be an absolute path."],
          ["shellKinds.1", "The commands weren't run, and nothing opened: shellKinds.1 must be one of PowerShell, CommandPrompt, Bash, Zsh, Fish, Wsl, Other."]
        ]);
        expect(runs(runtime)).toEqual([]);
      });

      it("shows the terminal, then rejects with why, when the runtime picked or opened it but didn't type the commands", async () => {
        const runtime: FakeRuntime = new FakeRuntime();
        const owners: TerminalOwners = await provideAsync(runtime);
        const reasons: unknown[] = [];

        for (const outcome of [TerminalRunOutcome.Input, TerminalRunOutcome.Tab, TerminalRunOutcome.Ended]) {
          runtime.runOutcome = outcome;
          const error: unknown = await owners.runAsync(OWNER, "rm -rf build/", null, []).catch((caught: unknown) => caught);
          expect(error).toBeInstanceOf(TerminalRunNotTypedException);
          const notTyped: TerminalRunNotTypedException = error as TerminalRunNotTypedException;
          reasons.push([notTyped.name, notTyped.sessionId, notTyped.reason, notTyped.message.includes("rm -rf")]);
        }

        expect(reasons).toEqual([
          ["TerminalRunNotTypedException", "run-1", "Input", false],
          ["TerminalRunNotTypedException", "run-2", "Tab", false],
          ["TerminalRunNotTypedException", "run-3", "Ended", false]
        ]);
        expect((await owners.runAsync(OWNER, "ls", null, []).catch((caught: Error) => caught)) as Error).toHaveProperty("message",
          "The commands weren't typed into terminal run-4: it ended, closed or restarted first.");
        expect(runtime.context.opened.map(t => t.instance)).toEqual(["run-1", "run-2", "run-3", "run-4"]);
      });

      it("refuses for shellKinds, naming the kinds and never the commands, and opens no tab, when the runtime finds no shell of them", async () => {
        const runtime: FakeRuntime = new FakeRuntime();
        const owners: TerminalOwners = await provideAsync(runtime);
        const opened: number = runtime.context.opened.length;
        runtime.context.handlers.set(TerminalNames.runMethod, async () => new TerminalRunResult(null, TerminalRunOutcome.NoShell).toJson());
        const refusals: unknown[] = [];

        for (const kinds of [[TerminalShellKind.Zsh], [TerminalShellKind.CommandPrompt, TerminalShellKind.Zsh, TerminalShellKind.Fish]]) {
          const error: unknown = await owners.runAsync(OWNER, "rm -rf build/", null, kinds).catch((caught: unknown) => caught);
          expect(error).toBeInstanceOf(RunShellKindsMissingException);
          refusals.push([(error as RunShellKindsMissingException).parameter, (error as RunShellKindsMissingException).message, (error as RunShellKindsMissingException).shellKinds]);
        }

        expect(refusals).toEqual([
          ["shellKinds", "The commands weren't run, and nothing opened: no shell of the kinds they need is installed (Zsh).", ["Zsh"]],
          ["shellKinds", "The commands weren't run, and nothing opened: no shell of the kinds they need is installed (Command Prompt, Zsh or fish).",
            ["CommandPrompt", "Zsh", "Fish"]]
        ]);
        expect(runtime.context.opened.length - opened).toBe(0);
      });

      it("opens no tab for a run that ended once the runtime no longer lists its terminal, or can't list the terminals, and still rejects", async () => {
        const runtime: FakeRuntime = new FakeRuntime();
        const owners: TerminalOwners = await provideAsync(runtime);
        runtime.context.handlers.set(TerminalNames.runMethod, async () => new TerminalRunResult("gone-1", TerminalRunOutcome.Ended).toJson());
        const reasonAsync = (): Promise<unknown> => owners.runAsync(OWNER, "ls", null, []).catch((caught: TerminalRunNotTypedException) => caught.reason);

        const sessionsAsync: ((parameters: JsonValue) => Promise<JsonValue>) | undefined = runtime.context.handlers.get(TerminalNames.sessionsMethod);

        const gone: unknown = await reasonAsync();
        runtime.context.handlers.set(TerminalNames.sessionsMethod, async () => {
          throw new Error("The runtime stopped.");
        });
        const unlisted: unknown = await reasonAsync();
        runtime.context.handlers.set(TerminalNames.sessionsMethod, async t => sessionsAsync?.(t) ?? null);

        expect([gone, unlisted]).toEqual([TerminalRunOutcome.Ended, TerminalRunOutcome.Ended]);
        expect(runtime.context.opened).toEqual([]);
        expect(runtime.context.logs).toEqual(["The terminals could not be listed after a run that ended, so its terminal got no tab: The runtime stopped."]);
      });

      it("rejects as the runtime does when it fails the run", async () => {
        const runtime: FakeRuntime = new FakeRuntime();
        const owners: TerminalOwners = await provideAsync(runtime);
        runtime.context.handlers.set(TerminalNames.runMethod, async () => {
          throw new Error("The runtime stopped.");
        });

        await expect(owners.runAsync(OWNER, "ls", null, [])).rejects.toThrow("The runtime stopped.");
        expect(runtime.context.opened).toEqual([]);
      });
    });

    describe("startRunAsync", () => {
      it("runs as runAsync does without a target, opening the tab while the owner shows, and gives the run with the runtime's terminal and run id", async () => {
        const runtime: FakeRuntime = new FakeRuntime();
        const owners: TerminalOwners = await provideAsync(runtime);

        const run: TerminalRun = await owners.startRunAsync(OWNER, "npm test\n", "/work", [TerminalShellKind.Bash], null);

        expect([run, run.sessionId, run.runId]).toEqual([new TerminalRun("run-1", "run-id-1"), "run-1", "run-id-1"]);
        expect(runs(runtime)).toEqual([{ owner: OWNER, command: "npm test\n", folder: "/work", shellKinds: ["Bash"], shellId: null, size: { cols: 80, rows: 24 },
          storedLimit: 104_857_600, sessionId: null, whenBusy: "Refuse", opensTab: true }]);
        expect(runtime.context.opened.map(t => [t.name, t.instance])).toEqual([["terminal.session", "run-1"]]);
      });

      it("gives the run's end from the runtime's event, also when the event came before the runtime's answer", async () => {
        const runtime: FakeRuntime = new FakeRuntime();
        runtime.addSession("c42", "bash", "/work", null, false, false, OWNER);
        const owners: TerminalOwners = await provideAsync(runtime);
        cleanups.push(() => TerminalRunEnds.detachAll());
        const ended = (runId: string, endedBy: TerminalRunEndedBy, exitCode: number | null): void =>
          runtime.context.emit(TerminalNames.runEndedEvent, new TerminalRunEnded("c42", runId, endedBy, exitCode).toJson());

        const first: TerminalRun = await owners.startRunAsync(OWNER, "npm test", null, [], new TerminalRunTarget("c42"));
        ended("run-id-2", TerminalRunEndedBy.TerminalEnded, null);
        ended("run-id-1", TerminalRunEndedBy.Command, 3);
        const second: TerminalRun = await owners.startRunAsync(OWNER, "ls", null, [], new TerminalRunTarget("c42"));

        expect([await first.ended, await second.ended]).toEqual([new TerminalRunEnd("Command", 3), new TerminalRunEnd("TerminalEnded", null)]);
      });

      it("gives the ends the runtime's answer carries, the run's own already resolved as startRunAsync resolves", async () => {
        const runtime: FakeRuntime = new FakeRuntime();
        runtime.addSession("c42", "bash", "/work", null, false, false, OWNER);
        const owners: TerminalOwners = await provideAsync(runtime);
        cleanups.push(() => TerminalRunEnds.detachAll());
        const first: TerminalRun = await owners.startRunAsync(OWNER, "make", null, [], new TerminalRunTarget("c42"));
        runtime.answerEnds = [new TerminalRunEnded("c42", "run-id-1", TerminalRunEndedBy.Command, 0),
          new TerminalRunEnded("c42", "run-id-2", TerminalRunEndedBy.NoIntegration, null)];

        const second: TerminalRun = await owners.startRunAsync(OWNER, "ls", null, [], new TerminalRunTarget("c42"));
        const settled: TerminalRunEnd | string = await Promise.race([second.ended, Promise.resolve("waiting")]);

        expect([settled, await first.ended]).toEqual([new TerminalRunEnd("NoIntegration", null), new TerminalRunEnd("Command", 0)]);
      });

      it("ends the runs still waiting as TerminalEnded when the runtime starts again", async () => {
        const runtime: FakeRuntime = new FakeRuntime();
        const owners: TerminalOwners = await provideAsync(runtime);
        const run: TerminalRun = await owners.startRunAsync(OWNER, "npm test", "/work", [], null);

        expect(await new TerminalWindowPart().reconnectAsync()).toBe(true);

        expect(await run.ended).toEqual(new TerminalRunEnd("TerminalEnded", null));
      });

      it("runs into the target's terminal with what it does while busy, and opens or shows no tab even while the owner shows", async () => {
        const runtime: FakeRuntime = new FakeRuntime();
        runtime.addSession("c42", "bash", "/work", null, false, false, OWNER);
        const owners: TerminalOwners = await provideAsync(runtime);
        const opened: number = runtime.context.opened.length;
        const shown: string[] = [];
        const target: ITerminalFocusTarget = { contains: () => false, isFor: t => t === "c42", showAsync: async () => shown.push("c42") > 0, hideDock: () => undefined };
        cleanups.push(TerminalFocus.add(target));

        const interrupting: TerminalRun = await owners.startRunAsync(OWNER, "ls", null, [], new TerminalRunTarget("c42", TerminalRunBusy.Interrupt));
        const refusing: TerminalRun = await owners.startRunAsync(OWNER, "ls", null, [], new TerminalRunTarget("c42"));

        expect([interrupting, refusing]).toEqual([new TerminalRun("c42", "run-id-1"), new TerminalRun("c42", "run-id-2")]);
        expect(runs(runtime).map(t => TerminalRunParams.fromJson(t)).map(t => [t.sessionId, t.whenBusy])).toEqual([["c42", "Interrupt"], ["c42", "Refuse"]]);
        expect([shown, runtime.context.opened.length - opened, runtime.sessions.length]).toEqual([[], 0, 1]);
      });

      it("rejects with Busy and the target's terminal, opening no tab, when the runtime finds its shell busy", async () => {
        const runtime: FakeRuntime = new FakeRuntime();
        runtime.addSession("c42", "bash", "/work", null, false, false, OWNER);
        const owners: TerminalOwners = await provideAsync(runtime);
        const opened: number = runtime.context.opened.length;
        runtime.runOutcome = TerminalRunOutcome.Busy;

        const notTyped: TerminalRunNotTypedException = await rejectionAsync(owners.startRunAsync(OWNER, "rm -rf build/", null, [], new TerminalRunTarget("c42")),
          TerminalRunNotTypedException);

        expect([notTyped.sessionId, notTyped.reason, notTyped.message]).toEqual(["c42", TerminalRunOutcome.Busy,
          "The commands weren't typed into terminal c42: its shell was busy, running a command or with text on its prompt line, and stayed so."]);
        expect(runtime.context.opened.length - opened).toBe(0);
      });

      it("rejects as Ended with the target's terminal, opening no tab, when the target isn't a terminal of the owner the runtime runs into", async () => {
        const runtime: FakeRuntime = new FakeRuntime();
        runtime.addSession("c7", "bash", "/work", null, false, false, "example.chat/7");
        const owners: TerminalOwners = await provideAsync(runtime);
        const opened: number = runtime.context.opened.length;
        const reasons: unknown[] = [];

        for (const sessionId of ["gone-1", "c7"]) {
          const error: TerminalRunNotTypedException = await rejectionAsync(owners.startRunAsync(OWNER, "rm -rf build/", null, [], new TerminalRunTarget(sessionId)),
            TerminalRunNotTypedException);
          reasons.push([error.sessionId, error.reason]);
        }

        expect(reasons).toEqual([["gone-1", TerminalRunOutcome.Ended], ["c7", TerminalRunOutcome.Ended]]);
        expect([runs(runtime).length, runtime.context.opened.length - opened, runtime.sessions.length]).toEqual([2, 0, 1]);
      });

      it("runs the commands in a new terminal of the owner, as the busy choice's Run in a new terminal does, once its target fails as Ended", async () => {
        const runtime: FakeRuntime = new FakeRuntime();
        const owners: TerminalOwners = await provideAsync(runtime);
        const error: TerminalRunNotTypedException = await rejectionAsync(owners.startRunAsync(OWNER, "npm test", "/work", [], new TerminalRunTarget("gone-1")),
          TerminalRunNotTypedException);

        const run: TerminalRun = await owners.startRunAsync(OWNER, "npm test", "/work", [], null);

        expect(error.reason).toBe(TerminalRunOutcome.Ended);
        expect([run.sessionId, runtime.sessions.map(t => [t.sessionId, t.owner])]).toEqual(["run-1", [["run-1", OWNER]]]);
      });

      it("refuses a blank target for sessionId, and an unknown busy choice for whenBusy, before anything is sent", async () => {
        const runtime: FakeRuntime = new FakeRuntime();
        const owners: TerminalOwners = await provideAsync(runtime);
        const refusalAsync = async (target: TerminalRunTarget): Promise<readonly [string, string]> => {
          const refusal: RunArgumentRefusedException = await rejectionAsync(owners.startRunAsync(OWNER, "ls", null, [], target), RunArgumentRefusedException);
          return [refusal.parameter, refusal.message];
        };

        expect([await refusalAsync(new TerminalRunTarget(" ")), await refusalAsync(new TerminalRunTarget("c42", "Wait" as TerminalRunBusy))]).toEqual([
          ["sessionId", "The commands weren't run, and nothing opened: sessionId must not be blank."],
          ["whenBusy", "The commands weren't run, and nothing opened: whenBusy must be one of Refuse, Interrupt."]
        ]);
        expect(runs(runtime)).toEqual([]);
      });

      describe("with shown", () => {
        function track(run: { answered: boolean }, notices: [string, boolean][]): (sessionId: string) => void {
          return t => notices.push([t, run.answered]);
        }

        it("opens and focuses no tab for a new terminal or a free one the runtime reuses, while the owner shows, and names each before the run answers", async () => {
          const runtime: FakeRuntime = new FakeRuntime();
          const owners: TerminalOwners = await provideAsync(runtime);
          const focused: string[] = [];
          cleanups.push(TerminalFocus.add({ contains: () => false, isFor: () => true, showAsync: async () => focused.push("shown") > 0, hideDock: () => undefined }));
          const notices: [string, boolean][] = [];
          const started: TerminalRun[] = [];

          for (const step of [() => undefined, () => runtime.freeSessions.add("run-1")]) {
            step();
            const run: { answered: boolean } = { answered: false };
            started.push(await owners.startRunAsync(OWNER, "npm test", "/work", [], null, track(run, notices)).finally(() => {
              run.answered = true;
            }));
          }

          expect(started).toEqual([new TerminalRun("run-1", "run-id-1"), new TerminalRun("run-1", "run-id-2")]);
          expect(notices).toEqual([["run-1", false], ["run-1", false]]);
          expect(runs(runtime).map(t => TerminalRunParams.fromJson(t).opensTab)).toEqual([false, false]);
          expect([runtime.context.opened, focused, runtime.sessions.map(t => [t.sessionId, t.opensTab])]).toEqual([[], [], [["run-1", false]]]);
        });

        it("names the target's terminal before the run is sent, and opens or shows no tab for it", async () => {
          const runtime: FakeRuntime = new FakeRuntime();
          runtime.addSession("c42", "bash", "/work", null, false, false, OWNER);
          const owners: TerminalOwners = await provideAsync(runtime);
          const opened: number = runtime.context.opened.length;
          const notices: [string, number][] = [];

          const run: TerminalRun = await owners.startRunAsync(OWNER, "ls", null, [], new TerminalRunTarget("c42"), t => notices.push([t, runs(runtime).length]));

          expect([run, notices, runtime.context.opened.length - opened]).toEqual([new TerminalRun("c42", "run-id-1"), [["c42", 0]], 0]);
          expect(runs(runtime).map(t => TerminalRunParams.fromJson(t).opensTab)).toEqual([false]);
        });

        it("starts this window's runs one at a time, so each run's terminal goes to its own shown, past a run that failed", async () => {
          const runtime: FakeRuntime = new FakeRuntime();
          const owners: TerminalOwners = await provideAsync(runtime);
          const notices: [string, string][] = [];
          runtime.holdOpens();

          const failing: Promise<TerminalRunNotTypedException> = rejectionAsync(owners.startRunAsync(OWNER, "ls", null, [], new TerminalRunTarget("gone-1"),
            t => notices.push(["failing", t])), TerminalRunNotTypedException);
          const first: Promise<TerminalRun> = owners.startRunAsync(OWNER, "npm test", "/work", [], null, t => notices.push(["first", t]));
          const second: Promise<TerminalRun> = owners.startRunAsync(OWNER, "npm test", "/work", [], null, t => notices.push(["second", t]));
          await vi.waitFor(() => expect(runs(runtime)).toHaveLength(1), { timeout: SpecWait.milliseconds });
          const sentWhileHeld: number = runs(runtime).length;
          runtime.releaseOpens();

          expect([(await failing).reason, await first, await second]).toEqual([TerminalRunOutcome.Ended, new TerminalRun("run-1", "run-id-1"),
            new TerminalRun("run-2", "run-id-2")]);
          expect([sentWhileHeld, notices]).toEqual([1, [["failing", "gone-1"], ["first", "run-1"], ["second", "run-2"]]]);
        });

        it("gives a run its terminal though a run with a tab starts while it waits for the runtime's word, and that run opens its own tab", async () => {
          const runtime: FakeRuntime = new FakeRuntime();
          const owners: TerminalOwners = await provideAsync(runtime);
          const notices: string[] = [];
          runtime.holdOpens();

          const withoutTab: Promise<TerminalRun> = owners.startRunAsync(OWNER, "npm test", "/work", [], null, t => notices.push(t));
          await vi.waitFor(() => expect(runs(runtime)).toHaveLength(1), { timeout: SpecWait.milliseconds });
          const withTab: Promise<TerminalRun> = owners.startRunAsync(OWNER, "ls", "/work", [], null);
          await vi.waitFor(() => expect(runs(runtime)).toHaveLength(2), { timeout: SpecWait.milliseconds });
          runtime.releaseOpens();

          expect([await withoutTab, await withTab]).toEqual([new TerminalRun("run-1", "run-id-1"), new TerminalRun("run-2", "run-id-2")]);
          expect([notices, runtime.context.opened.map(t => t.instance)]).toEqual([["run-1"], ["run-2"]]);
        });

        it("names a run's terminal once from the run's answer when the runtime's word of it didn't come before, and not again for a late word", async () => {
          const runtime: FakeRuntime = new FakeRuntime();
          const owners: TerminalOwners = await provideAsync(runtime);
          const notices: string[] = [];
          runtime.announcesRuns = false;

          const run: TerminalRun = await owners.startRunAsync(OWNER, "npm test", "/work", [], null, t => notices.push(t));
          runtime.context.emit(TerminalNames.runOpenedEvent, new TerminalReference(run.sessionId).toJson());

          expect([run, notices, runtime.context.opened]).toEqual([new TerminalRun("run-1", "run-id-1"), ["run-1"], []]);
        });

        it("ignores the runtime's word of a run's terminal when no run without a tab is under way, or no app provides owners", async () => {
          const runtime: FakeRuntime = new FakeRuntime();
          const owners: TerminalOwners = await provideAsync(runtime);
          const notices: string[] = [];

          runtime.context.emit(TerminalNames.runOpenedEvent, new TerminalReference("stray-1").toJson());
          await owners.startRunAsync(OWNER, "ls", null, [], null, t => notices.push(t));
          runtime.context.emit(TerminalNames.runOpenedEvent, new TerminalReference("stray-2").toJson());
          await owners.removeAsync();
          runtime.context.emit(TerminalNames.runOpenedEvent, new TerminalReference("stray-3").toJson());

          expect([notices, runtime.context.logs]).toEqual([["run-1"], []]);
        });
      });
    });

    describe("readRunOutputAsync", () => {
      it("gives at most 2000 lines unless asked, up to 5000, and its output colors are the protocol's", () => {
        expect([TerminalOwners.defaultRunLines, TerminalOwners.maximumRunLines, TerminalOwners.defaultColor, TerminalOwners.rgbColor]).toEqual([2000, 5000, -1, 0x1000000]);
      });

      it("asks the runtime for the run's last lines and gives its output, with how many earlier lines were cut", async () => {
        const runtime: FakeRuntime = new FakeRuntime();
        const owners: TerminalOwners = await provideAsync(runtime);
        runtime.runOutput = new TerminalRunOutput([new TerminalLine("$ ls", false, [new TerminalTextRun(4, 2, TerminalOwners.defaultColor, 1)]),
          new TerminalLine("a", false, [new TerminalTextRun(1, TerminalOwners.rgbColor + 0xff0000, TerminalOwners.defaultColor, 0)])], 3);

        const output: TerminalRunOutput = await owners.readRunOutputAsync(new TerminalRun("c42", "run-id-1"));
        await owners.readRunOutputAsync(new TerminalRun("c42", "run-id-1"), 1);
        await owners.readRunOutputAsync(new TerminalRun("c42", "run-id-1"), 5000);

        expect([output.lines.map(t => t.text), output.lines[1]?.runs[0]?.foreground, output.cutLines]).toEqual([["$ ls", "a"], 0x1ff0000, 3]);
        expect(runtime.context.sent(TerminalNames.runOutputMethod)).toEqual([{ sessionId: "c42", runId: "run-id-1", maximumLines: 2000 },
          { sessionId: "c42", runId: "run-id-1", maximumLines: 1 }, { sessionId: "c42", runId: "run-id-1", maximumLines: 5000 }]);
      });

      it("rejects with the terminal and the run when the runtime can't give the run's output", async () => {
        const runtime: FakeRuntime = new FakeRuntime();
        const owners: TerminalOwners = await provideAsync(runtime);

        const notFound: TerminalRunNotFoundException = await rejectionAsync(owners.readRunOutputAsync(new TerminalRun("c42", "run-id-9")), TerminalRunNotFoundException);

        expect([notFound.name, notFound.sessionId, notFound.runId, notFound.message]).toEqual(["TerminalRunNotFoundException", "c42", "run-id-9",
          "Terminal c42 has no run run-id-9 whose output it can give."]);
      });

      it("rejects as the runtime does when it fails the read", async () => {
        const runtime: FakeRuntime = new FakeRuntime();
        const owners: TerminalOwners = await provideAsync(runtime);
        runtime.context.handlers.set(TerminalNames.runOutputMethod, async () => {
          throw new Error("The runtime stopped.");
        });

        const error: Error = await rejectionAsync(owners.readRunOutputAsync(new TerminalRun("c42", "run-id-1")), Error);

        expect(error).not.toBeInstanceOf(TerminalRunNotFoundException);
        expect(error.message).toBe("The runtime stopped.");
      });

      it("rejects with the terminal and the run, sending nothing, for a run whose ids the protocol refuses", async () => {
        const runtime: FakeRuntime = new FakeRuntime();
        const owners: TerminalOwners = await provideAsync(runtime);
        const errors: TerminalRunNotFoundException[] = [];

        for (const run of [new TerminalRun("", "r1"), new TerminalRun("c42", " "), new TerminalRun("c42", "r".repeat(201))])
          errors.push(await rejectionAsync(owners.readRunOutputAsync(run), TerminalRunNotFoundException));

        expect(errors.map(t => [t.sessionId, t.runId])).toEqual([["", "r1"], ["c42", " "],
          ["c42", "r".repeat(201)]]);
        expect(runtime.context.sent(TerminalNames.runOutputMethod)).toEqual([]);
      });

      it("throws a RunLinesRefusedException before anything is sent for a number of lines out of range or not whole", async () => {
        const runtime: FakeRuntime = new FakeRuntime();
        const owners: TerminalOwners = await provideAsync(runtime);
        const errors: RunLinesRefusedException[] = [];

        for (const maximumLines of [0, 5001, 1.5])
          errors.push(await rejectionAsync(owners.readRunOutputAsync(new TerminalRun("c42", "run-id-1"), maximumLines), RunLinesRefusedException));

        expect(errors.map(t => [t.lines, t.maximum])).toEqual([[0, 5000], [5001, 5000], [1.5, 5000]]);
        expect(errors.map(t => t.message)).toEqual([
          "A run's output can be read up to a whole number from 1 to 5000 of lines, not 0.",
          "A run's output can be read up to a whole number from 1 to 5000 of lines, not 5001.",
          "A run's output can be read up to a whole number from 1 to 5000 of lines, not 1.5."
        ]);
        expect(runtime.context.sent(TerminalNames.runOutputMethod)).toEqual([]);
      });
    });
  });
});
