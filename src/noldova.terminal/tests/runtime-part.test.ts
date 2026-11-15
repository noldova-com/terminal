/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { release, tmpdir } from "node:os";

import { ArgumentException } from "@noldova/context.exceptions";
import { ShellClients } from "@noldova/desktop.protocol";
import { type IMethodHandler, PermissionDecision, RequestContext, ToolFailure, ToolFailureCode, ToolResult, type ToolSession } from "@noldova/desktop.runtime";
import { RuntimeTerminalOwners, TerminalNames } from "@noldova/terminal.protocol";
import { afterEach, describe, it, type MockInstance, vi } from "vitest";

import { RuntimePart, SystemRequirement, UnsupportedSystemException } from "../src/api/index.ts";
import { HostEndedException } from "../src/exceptions/host-ended.exception.ts";
import { SystemShortfall } from "../src/models/system-shortfall.ts";
import { InheritedEnvironment } from "../src/services/inherited-environment.ts";
import { MacEnvironment } from "../src/services/mac-environment.ts";
import { ShellEnvironment } from "../src/services/shell-environment.ts";
import { SystemRequirements } from "../src/services/system-requirements.ts";
import { TerminalOwnerService } from "../src/services/terminal-owner.service.ts";
import { FakePermissionRequests } from "./fixtures/fake-permission-requests.fixture.ts";
import { FakeModuleLog, FakeRuntimePartContext } from "./fixtures/fake-runtime-part-context.fixture.ts";
import { createBindings, SCOPE } from "./fixtures/tool-call-contexts.fixture.ts";

const contexts: FakeRuntimePartContext[] = [];

function createContext(): FakeRuntimePartContext {
  const context: FakeRuntimePartContext = new FakeRuntimePartContext();
  contexts.push(context);
  return context;
}

describe("RuntimePart", () => {
  afterEach(async () => {
    vi.restoreAllMocks();
    await Promise.all(contexts.splice(0).map(t => t.endAsync()));
  });

  it("registers every terminal method and declares every terminal event", async () => {
    const context: FakeRuntimePartContext = createContext();
    const part: RuntimePart = new RuntimePart();

    await part.activateAsync(context);

    assert.deepEqual([...context.methods.keys()], [
      "terminal.shells", "terminal.open", "terminal.close", "terminal.restart", "terminal.sessions", "terminal.attach",
      "terminal.input", "terminal.resize", "terminal.ack", "terminal.visibility", "terminal.detach", "terminal.lines",
      "terminal.restore", "terminal.closeOwner", "terminal.launch", "terminal.run", "terminal.runOutput", "terminal.windowStarted",
      "terminal.showOwner", "terminal.rename", "terminal.complete", "terminal.findCommands"
    ]);
    assert.deepEqual([...context.events.keys()], [
      "terminal.output", "terminal.exited", "terminal.restarted", "terminal.titleChanged", "terminal.cwdChanged", "terminal.detached", "terminal.closed",
      "terminal.opened", "terminal.launchCommandEnded", "terminal.runOpened", "terminal.runEnded", "terminal.renamed",
      "terminal.commandAdded"
    ]);
    await part.deactivateAsync();
  });

  it("declares in module.json exactly the methods it registers, the events it declares and the tools it registers, its pseudo-terminals, and withdraws the tools at deactivation", async () => {
    const context: FakeRuntimePartContext = createContext();
    const part: RuntimePart = new RuntimePart();
    await part.activateAsync(context);
    const declaration: { pseudoTerminals?: boolean; contributes: { methods: string[]; events: string[]; tools: string[] } } =
      JSON.parse(readFileSync(new URL("../module.json", import.meta.url), "utf8"));

    assert.equal(declaration.pseudoTerminals, true);

    assert.deepEqual(declaration.contributes.methods, [...context.methods.keys()]);
    assert.deepEqual([...context.events.keys()].sort(), [...declaration.contributes.events].sort());
    assert.deepEqual([...context.events.keys()].sort(), [...TerminalNames.events].sort());
    assert.deepEqual(context.tools.openSession(SCOPE, createBindings()).listTools().map(t => t.name), declaration.contributes.tools);
    await part.deactivateAsync();
    assert.deepEqual(context.tools.openSession(SCOPE, createBindings()).listTools(), []);
  });

  it("asks the app's answerer through Noldova Desktop before a tool acts, acts on none it denies, and lists terminals without asking", async () => {
    const context: FakeRuntimePartContext = createContext();
    const permissions: FakePermissionRequests = new FakePermissionRequests();
    context.registry.permissions.registerAnswerer("app", permissions, new FakeModuleLog());
    permissions.answerNext(PermissionDecision.Denied);
    const part: RuntimePart = new RuntimePart();
    await part.activateAsync(context);
    const session: ToolSession = context.tools.openSession(SCOPE, createBindings());

    const listed: ToolResult | ToolFailure = await session.callAsync("terminal_list", {});
    const opened: ToolResult | ToolFailure = await session.callAsync("terminal_open", {});

    assert.deepEqual(listed instanceof ToolResult ? listed.structured : listed, { terminals: [] });
    assert.deepEqual(opened instanceof ToolFailure ? [opened.code, opened.moduleCode] : opened, [ToolFailureCode.Denied, null]);
    assert.deepEqual(permissions.questions.map(t => [t.module, t.session, t.request.action]), [["terminal", "session-1", "terminal.open"]]);
    await part.deactivateAsync();
  });

  it("declares Font size in settings.json: 13 pixels by default, from 8 to 32 in steps of 1, for this device, on the Terminal page", () => {
    const declaration: { settings: { name: string }[] } = JSON.parse(readFileSync(new URL("../settings.json", import.meta.url), "utf8"));

    assert.deepEqual(declaration.settings.find(t => t.name === "terminal.fontSize"), {
      name: "terminal.fontSize",
      title: "Font size",
      description: "The size of the text in every terminal, in pixels. No text size under Appearance changes it.",
      type: { kind: "Number", minimum: 8, maximum: 32, step: 1 },
      default: 13,
      locality: "Device",
      scopes: [],
      page: "Terminal",
      group: "Terminal"
    });
  });

  it("declares Suggest earlier commands in settings.json: on by default, shared, since the runtime reads it, on the Terminal page", () => {
    const declaration: { settings: { name: string }[] } = JSON.parse(readFileSync(new URL("../settings.json", import.meta.url), "utf8"));
    const module: { contributes: { settings: string[] } } = JSON.parse(readFileSync(new URL("../module.json", import.meta.url), "utf8"));

    assert.deepEqual(declaration.settings.find(t => t.name === "terminal.suggestions"), {
      name: "terminal.suggestions",
      title: "Suggest earlier commands",
      description: "Whether a terminal shows the rest of an earlier command in grey as you type at a bash, zsh or PowerShell prompt. \u2192 or End at the line's end takes it.",
      type: { kind: "Boolean" },
      default: true,
      locality: "Shared",
      scopes: [],
      page: "Terminal",
      group: "Terminal"
    });
    assert.ok(module.contributes.settings.includes("terminal.suggestions"));
  });

  it("declares Color typed commands in settings.json: off by default, shared, on the Terminal page", () => {
    const declaration: { settings: { name: string }[] } = JSON.parse(readFileSync(new URL("../settings.json", import.meta.url), "utf8"));
    const module: { contributes: { settings: string[] } } = JSON.parse(readFileSync(new URL("../module.json", import.meta.url), "utf8"));

    assert.deepEqual(declaration.settings.find(t => t.name === "terminal.commandColors"), {
      name: "terminal.commandColors",
      title: "Color typed commands",
      description: "Whether a terminal colors the command you type at a bash, zsh or PowerShell prompt: its name, options, strings, paths, variables, operators, keywords and comments. Text the shell colors itself keeps its own colors.",
      type: { kind: "Boolean" },
      default: false,
      locality: "Shared",
      scopes: [],
      page: "Terminal",
      group: "Terminal"
    });
    assert.ok(module.contributes.settings.includes("terminal.commandColors"));
  });

  it("declares Complete with a list in settings.json: on by default, shared, on the Terminal page", () => {
    const declaration: { settings: { name: string }[] } = JSON.parse(readFileSync(new URL("../settings.json", import.meta.url), "utf8"));
    const module: { contributes: { settings: string[] } } = JSON.parse(readFileSync(new URL("../module.json", import.meta.url), "utf8"));

    assert.deepEqual(declaration.settings.find(t => t.name === "terminal.completionList"), {
      name: "terminal.completionList",
      title: "Complete with a list",
      description: "Whether Tab at a bash, zsh or PowerShell prompt opens a list of what can follow: files, folders, commands, branches, scripts and a command's options. Turned off, Tab goes to the shell, which completes as it does on its own.",
      type: { kind: "Boolean" },
      default: true,
      locality: "Shared",
      scopes: [],
      page: "Terminal",
      group: "Terminal"
    });
    assert.ok(module.contributes.settings.includes("terminal.completionList"));
  });

  it("keeps the person's terminals in the module's database for the next run", async () => {
    const context: FakeRuntimePartContext = createContext();
    const part: RuntimePart = new RuntimePart();
    await part.activateAsync(context);
    const handler: IMethodHandler | undefined = context.methods.get("terminal.restore");

    assert.deepEqual(part.migrations.map(t => t.id), ["create-terminals", "add-terminal-owner", "add-terminal-opens-tab", "add-terminal-name"]);
    assert.ok(handler !== undefined);
    assert.equal(await handler.handleAsync(new RequestContext(ShellClients.mainProcess, { size: { cols: 80, rows: 24 }, shellId: null, storedLimit: 104_857_600 }, new AbortController().signal, 1, 1)), null);
    assert.deepEqual(context.database.statements, []);
    await part.deactivateAsync();
  });

  it("publishes the owners service, which forgets an owner's kept terminals with no window open", async () => {
    const context: FakeRuntimePartContext = createContext();
    context.database.run("INSERT INTO terminals (session_id, shell_id, folder, is_panel_terminal, owner, position) VALUES ('s1', 'bash', '/work', 0, 'example.chat/42', 1)");
    context.database.run("INSERT INTO terminals (session_id, shell_id, folder, is_panel_terminal, owner, position) VALUES ('s2', 'bash', '/work', 0, NULL, 2)");
    const part: RuntimePart = new RuntimePart();
    await part.activateAsync(context);
    const service: object | undefined = context.services.get("terminal.owners");

    assert.deepEqual([...context.services.keys()], ["terminal.owners"]);
    assert.ok(service instanceof TerminalOwnerService);
    await service.closeAsync("example.chat/42");
    await assert.rejects(service.closeAsync(" "), (error: unknown) => error instanceof ArgumentException && error.parameterName === "owner");

    assert.deepEqual(context.database.readAll("SELECT session_id FROM terminals").map(t => t["session_id"]), ["s2"]);
    assert.deepEqual(context.events.get("terminal.closed")?.published, []);
    await part.deactivateAsync();
    await assert.rejects(service.closeAsync("example.chat/42"), (error: unknown) => error instanceof HostEndedException);
  });

  it("publishes the owners service as the RuntimeTerminalOwners contract an app's runtime part checks it against, from the copy of terminal-protocol both load", async () => {
    const context: FakeRuntimePartContext = createContext();
    const part: RuntimePart = new RuntimePart();
    await part.activateAsync(context);
    const service: object | undefined = context.services.get("terminal.owners");
    const read = <T extends object>(name: string, type: abstract new (...args: never[]) => T): T => {
      const published: object | undefined = context.services.get(name);
      assert.ok(published instanceof type, `${name} is not a ${type.name}`);
      return published;
    };

    assert.ok(service instanceof RuntimeTerminalOwners);
    const owners: RuntimeTerminalOwners = read("terminal.owners", RuntimeTerminalOwners);
    owners.bindAgentSession("session-1", "example.chat/42");
    owners.unbindAgentSession("session-1");
    await owners.closeAsync("example.chat/42");

    assert.equal(owners, service);
    await part.deactivateAsync();
  });

  it("answers a method through its handler", async () => {
    const context: FakeRuntimePartContext = createContext();
    const part: RuntimePart = new RuntimePart();
    await part.activateAsync(context);
    const handler: IMethodHandler | undefined = context.methods.get("terminal.sessions");

    assert.ok(handler !== undefined);
    assert.deepEqual(await handler.handleAsync(new RequestContext("test", null, new AbortController().signal, 1)), { sessions: [] });
    await part.deactivateAsync();
  });

  it("hears Noldova Desktop's closures of windows and connections", async () => {
    const context: FakeRuntimePartContext = createContext();
    const part: RuntimePart = new RuntimePart();
    await part.activateAsync(context);

    await context.closeClientAsync(1, 1);
    await context.closeClientAsync(1, null);

    assert.equal(context.activeCallsOf("onClientClosed").length, 1);
    await part.deactivateAsync();
  });

  it("checks this system's minimums, and reads the shells' environment for this process's platform, variables and locale", async () => {
    const context: FakeRuntimePartContext = createContext();
    const shortfall: MockInstance<typeof SystemRequirements.findShortfall> = vi.spyOn(SystemRequirements, "findShortfall");
    const environment: MockInstance<typeof ShellEnvironment.create> = vi.spyOn(ShellEnvironment, "create");
    const part: RuntimePart = new RuntimePart();

    await part.activateAsync(context);
    await part.deactivateAsync();

    assert.deepEqual(shortfall.mock.calls.map(t => [t[0], t[1], typeof t[2]]), [[process.platform, release(), "object"]]);
    assert.deepEqual(environment.mock.calls.map(t => [t[0], t[1], t[3], t[4], t[5]]),
      [[process.platform, process.env, context.log, Intl.DateTimeFormat().resolvedOptions().locale, MacEnvironment.hasSystemLocaleAsync]]);
  });

  it("refuses to start on a system below its minimums, and logs why", async () => {
    const context: FakeRuntimePartContext = createContext();
    vi.spyOn(SystemRequirements, "findShortfall").mockReturnValue(new SystemShortfall(SystemRequirement.Glibc, "2.27"));
    const part: RuntimePart = new RuntimePart();
    const message: string = "The terminal module needs glibc 2.28 or later for its pseudo-terminal library; this system has glibc 2.27.";

    await assert.rejects(part.activateAsync(context), (error: unknown) => {
      assert.ok(error instanceof UnsupportedSystemException);
      assert.deepEqual([error.requirement, error.found, error.message], [SystemRequirement.Glibc, "2.27", message]);
      return true;
    });

    assert.deepEqual(context.log.callsOf("write"), [[message]]);
    assert.equal(context.methods.size, 0);
    await part.deactivateAsync();
  });

  it("starts the shells' environment, whose programs start through the part's context, when it activates and ends it when it deactivates", async () => {
    const context: FakeRuntimePartContext = createContext();
    const environment: InheritedEnvironment = new InheritedEnvironment({});
    const start: MockInstance<() => void> = vi.spyOn(environment, "start");
    const end: MockInstance<() => void> = vi.spyOn(environment, "end");
    const { promise: exited, resolve: onExit } = Promise.withResolvers<string>();
    vi.spyOn(ShellEnvironment, "create").mockImplementation((_platform, _variables, tools) => {
      assert.equal(tools.temporaryFolder, tmpdir());
      tools.starter.start(process.execPath, ["-e", "process.exit(0);"], { onLine: () => undefined, onExit });
      return environment;
    });
    const part: RuntimePart = new RuntimePart();

    await part.activateAsync(context);
    assert.deepEqual([start.mock.calls.length, end.mock.calls.length], [1, 0]);
    await exited;
    await part.deactivateAsync();

    assert.deepEqual([start.mock.calls.length, end.mock.calls.length], [1, 1]);
    assert.deepEqual(context.requests.map(t => t.program), [process.execPath]);
  });

  it("ends the shells' environment when its activation fails after starting it", async () => {
    const context: FakeRuntimePartContext = createContext();
    context.answer("declareEvent", () => {
      throw new Error("No events here.");
    });
    const environment: InheritedEnvironment = new InheritedEnvironment({});
    const start: MockInstance<() => void> = vi.spyOn(environment, "start");
    const end: MockInstance<() => void> = vi.spyOn(environment, "end");
    vi.spyOn(ShellEnvironment, "create").mockReturnValue(environment);
    const part: RuntimePart = new RuntimePart();

    await assert.rejects(part.activateAsync(context), { message: "No events here." });

    assert.deepEqual([start.mock.calls.length, end.mock.calls.length], [1, 1]);
    assert.deepEqual([...context.methods.keys()], []);
    await part.deactivateAsync();
    assert.equal(end.mock.calls.length, 1);
  });

  it("deactivates when it was never activated, and twice", async () => {
    const part: RuntimePart = new RuntimePart();

    await part.deactivateAsync();
    await part.activateAsync(createContext());
    await part.deactivateAsync();
    await part.deactivateAsync();
  });
});
