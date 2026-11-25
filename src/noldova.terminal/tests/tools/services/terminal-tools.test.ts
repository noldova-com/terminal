/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import assert from "node:assert/strict";

import type { JsonObject } from "@noldova/context.json";
import { PermissionCenter, PermissionDecision, ToolAbortReason, ToolFailure, ToolFailureCode, ToolResult, type ToolSession } from "@noldova/desktop.runtime";
import { FakeToolsContext } from "@noldova/desktop.runtime/testing";
import { describe, it } from "vitest";

import type { TerminalTool } from "../../../src/tools/services/terminal-tool.ts";
import { TerminalTools } from "../../../src/tools/services/terminal-tools.ts";
import type { FakeAgentTerminal } from "../../fixtures/fake-agent-terminals.fixture.ts";
import { FakeAgentTerminals, FakeTerminalPrompt } from "../../fixtures/fake-agent-terminals.fixture.ts";
import { FakePermissionRequests } from "../../fixtures/fake-permission-requests.fixture.ts";
import { FakeModuleLog } from "../../fixtures/fake-runtime-part-context.fixture.ts";
import { RegistryToolsContext, TOOL_NAMES } from "../../fixtures/registry-tools-context.fixture.ts";
import { createBindings, createCall, SCOPE, SESSION_ID } from "../../fixtures/tool-call-contexts.fixture.ts";

class ToolsFixture {
  public readonly permissions: FakePermissionRequests = new FakePermissionRequests();
  public readonly log: FakeModuleLog = new FakeModuleLog();
  public readonly context: RegistryToolsContext = new RegistryToolsContext(new FakeToolsContext(), this.log, new PermissionCenter("app"));
  public readonly terminals: FakeAgentTerminals = new FakeAgentTerminals();
  public readonly tools: TerminalTools = new TerminalTools(this.terminals);

  public constructor() {
    this.context.registry.permissions.registerAnswerer("app", this.permissions, new FakeModuleLog());
    this.tools.publish(this.context.tools, this.log);
  }

  public openSession(): ToolSession {
    return this.context.tools.openSession(SCOPE, createBindings());
  }
}

function structuredOf(answer: ToolResult | ToolFailure): JsonObject {
  assert.ok(answer instanceof ToolResult, answer instanceof ToolFailure ? `${answer.code}: ${answer.message}` : "");
  return answer.structured ?? {};
}

function failureOf(answer: ToolResult | ToolFailure): ToolFailure {
  assert.ok(answer instanceof ToolFailure);
  return answer;
}

class UnrunCase {
  public readonly name: string;
  public readonly decisions: readonly PermissionDecision[];
  public readonly endsCall: boolean;
  public readonly code: ToolFailureCode;

  public constructor(name: string, decisions: readonly PermissionDecision[], endsCall: boolean, code: ToolFailureCode) {
    this.name = name;
    this.decisions = decisions;
    this.endsCall = endsCall;
    this.code = code;
  }
}

describe("TerminalTools", () => {
  it("registers the seven tools module.json declares, each with its risk, hints, resource and next tool, as Noldova Desktop reads them", () => {
    const fixture: ToolsFixture = new ToolsFixture();

    assert.deepEqual(fixture.tools.toolNames, TOOL_NAMES);
    assert.deepEqual(
      fixture.openSession().listTools().map(t => [t.name, t.risk.default, t.risk.maximum, t.isReadOnly, t.isResumable, t.marksSending, t.resource, t.nextTool]),
      [
        ["terminal_list", "Low", "Low", true, true, false, null, null],
        ["terminal_read", "Low", "Medium", true, true, false, null, null],
        ["terminal_open", "Medium", "Medium", false, false, true, null, "terminal_list"],
        ["terminal_run", "High", "High", false, true, true, "/terminal_id", null],
        ["terminal_write", "High", "High", false, false, true, "/terminal_id", "terminal_read"],
        ["terminal_interrupt", "Medium", "Medium", false, false, true, "/terminal_id", "terminal_read"],
        ["terminal_close", "Medium", "Medium", false, false, true, "/terminal_id", "terminal_list"]
      ]);
  });

  it("asks through Noldova Desktop's permission center, as the terminal module for the call's session and scope, and acts on the answer", async () => {
    const fixture: ToolsFixture = new ToolsFixture();
    const session: ToolSession = fixture.openSession();
    fixture.permissions.answerNext(PermissionDecision.AllowedOnce, PermissionDecision.Denied);

    const opened: JsonObject = structuredOf(await session.callAsync("terminal_open", { explanation: "Builds the project." }));
    const denied: ToolFailure = failureOf(await session.callAsync("terminal_close", { terminal_id: String(opened["terminal_id"]) }));

    assert.deepEqual(fixture.permissions.questions.map(t => [t.module, t.session, t.scope, t.request.action, t.request.title]), [
      ["terminal", "session-1", SCOPE, "terminal.open", "Open a terminal"],
      ["terminal", "session-1", SCOPE, "terminal.close", "Close a terminal and end its shell"]
    ]);
    assert.deepEqual(fixture.permissions.questions[0]?.request.details.at(-1), { label: "Why", kind: "AgentText", value: "Builds the project." });
    assert.deepEqual([denied.code, denied.message], [ToolFailureCode.Denied, "terminal_close did not run: its permission request ended as Denied."]);
    assert.deepEqual([fixture.terminals.openings.length, fixture.terminals.terminals[0]?.closes], [1, 0]);
  });

  it("runs the command an allowed request showed, through Noldova Desktop's center", async () => {
    const fixture: ToolsFixture = new ToolsFixture();
    const terminal: FakeAgentTerminal = fixture.terminals.add("t1", "session-1");
    fixture.permissions.answerNext(PermissionDecision.AllowedOnce);

    const ran: JsonObject = structuredOf(await fixture.openSession().callAsync("terminal_run", { terminal_id: "t1", command: "make test" }));

    assert.equal(ran["terminal_id"], "t1");
    assert.equal(fixture.permissions.questions[0]?.request.details.find(t => t.label === "Command")?.value, "make test");
    assert.deepEqual(terminal.runs.map(t => t.command), ["make test"]);
  });

  for (const { name, decisions, endsCall, code } of [
    new UnrunCase("a denied request", [PermissionDecision.Denied], false, ToolFailureCode.Denied),
    new UnrunCase("an always denied request", [PermissionDecision.DeniedAlways], false, ToolFailureCode.Denied),
    new UnrunCase("a request cancelled while it waits", [], true, ToolFailureCode.Withdrawn),
    new UnrunCase("a grant that comes after its call ended", [PermissionDecision.AllowedOnce], true, ToolFailureCode.Withdrawn)
  ])
    it(`runs nothing on ${name}, through Noldova Desktop's center`, async () => {
      const fixture: ToolsFixture = new ToolsFixture();
      const terminal: FakeAgentTerminal = fixture.terminals.add("t1", "session-1");
      const controller: AbortController = new AbortController();
      fixture.permissions.answerNext(...decisions);
      if (endsCall)
        fixture.permissions.whenRaised(() => controller.abort(ToolAbortReason.Cancelled));

      const failure: ToolFailure = failureOf(await fixture.openSession().callAsync("terminal_run", { terminal_id: "t1", command: "make test" },
        { signal: controller.signal }));

      assert.equal(failure.code, code);
      assert.equal(fixture.permissions.questions.length, 1);
      assert.deepEqual(terminal.runs, []);
    });

  it("asks again for keys a program's later question gets, since an always answer to a write counts for nothing", async () => {
    const fixture: ToolsFixture = new ToolsFixture();
    const terminal: FakeAgentTerminal = fixture.terminals.add("t1", "session-1");
    terminal.prompt = new FakeTerminalPrompt(false, "/work/project");
    const session: ToolSession = fixture.openSession();
    fixture.permissions.answerNext(PermissionDecision.AllowedAlways, PermissionDecision.AllowedOnce);

    const refused: ToolFailure = failureOf(await session.callAsync("terminal_write", { terminal_id: "t1", keys: "y\r" }));
    structuredOf(await session.callAsync("terminal_write", { terminal_id: "t1", keys: "y\r" }));

    assert.equal(refused.code, ToolFailureCode.Denied);
    assert.deepEqual(fixture.permissions.questions.map(t => t.request.options), [["AllowOnce", "Deny"], ["AllowOnce", "Deny"]]);
    assert.deepEqual(terminal.writes, ["y\r"]);
  });

  it("lets a session open a terminal and run in it, and keeps it from another session", async () => {
    const fixture: ToolsFixture = new ToolsFixture();
    const session: ToolSession = fixture.openSession();
    const other: ToolSession = fixture.openSession();
    fixture.permissions.answerNext(PermissionDecision.AllowedOnce, PermissionDecision.AllowedOnce);

    const terminalId: string = String(structuredOf(await session.callAsync("terminal_open", {}))["terminal_id"]);
    const ran: JsonObject = structuredOf(await session.callAsync("terminal_run", { terminal_id: terminalId, command: "pwd" }));
    const refused: ToolFailure = failureOf(await other.callAsync("terminal_run", { terminal_id: terminalId, command: "pwd" }));

    assert.equal(ran["terminal_id"], terminalId);
    assert.deepEqual([refused.code, refused.moduleCode], [ToolFailureCode.Refused, "terminal.notFound"]);
  });

  it("refuses a call whose session has no working folder bound", async () => {
    const fixture: ToolsFixture = new ToolsFixture();

    const refused: ToolFailure = failureOf(await fixture.context.tools.openSession(SCOPE, {}).callAsync("terminal_list", {}));

    assert.deepEqual([refused.code, refused.moduleCode], [ToolFailureCode.Refused, "terminal.invalidBinding"]);
  });

  it("closes the terminals a session opened when it ends, leaves the others, and forgets what the session read", async () => {
    const fixture: ToolsFixture = new ToolsFixture();
    const own: FakeAgentTerminal = fixture.terminals.add("own", "session-1");
    const persons: FakeAgentTerminal = fixture.terminals.add("persons", null);
    const others: FakeAgentTerminal = fixture.terminals.add("others", "session-2");
    const session: ToolSession = fixture.openSession();
    own.output = "abc";
    fixture.permissions.answerNext(PermissionDecision.AllowedOnce, PermissionDecision.AllowedOnce);
    await session.callAsync("terminal_read", { terminal_id: "own" });
    const closed: Promise<void> = new Promise<void>(resolve => own.onClosing = resolve);

    session.end();

    await closed;
    assert.deepEqual([own.closes, persons.closes, others.closes], [1, 0, 0]);
    assert.deepEqual(fixture.terminals.endedSessions, ["session-1"]);
    const readTool: TerminalTool<unknown> | undefined = fixture.tools.tools.find(t => t.descriptor.name === "terminal_read");
    assert.ok(!Object.isUndefined(readTool));
    const reread: ToolResult = await readTool.handleAsync(createCall({ terminal_id: "own" }, undefined, [], SESSION_ID, fixture.permissions));
    assert.equal(reread.structured?.["output"], "abc");
  });

  it("logs a terminal that fails to close when its session ends", async () => {
    const fixture: ToolsFixture = new ToolsFixture();
    fixture.terminals.add("own", "session-1").onClosing = () => {
      throw new Error("boom");
    };
    fixture.terminals.add("other", "session-2").onClosing = () => {
      throw "The pty is gone.";
    };

    const messages: string[] = [];
    const logged: Promise<void> = new Promise<void>(resolve => fixture.log.answer("write", message => {
      messages.push(message);
      if (messages.length === 2)
        resolve();
    }));

    fixture.openSession().end();
    fixture.openSession().end();

    await logged;
    assert.deepEqual(messages, [
      "The terminals of the ended agent session session-1 did not all close: boom",
      "The terminals of the ended agent session session-2 did not all close: The pty is gone."
    ]);
  });

  it("leaves a terminal with its chat's owner open when its session ends, for the chat's next session to list, read and run in", async () => {
    const fixture: ToolsFixture = new ToolsFixture();
    const session: ToolSession = fixture.openSession();
    fixture.terminals.sessionOwners.set("session-1", "example.chat/42");
    fixture.permissions.answerNext(...Array<PermissionDecision>(5).fill(PermissionDecision.AllowedOnce));

    const terminalId: string = String(structuredOf(await session.callAsync("terminal_open", {}))["terminal_id"]);
    for (const terminal of fixture.terminals.terminals)
      terminal.output = "abc";
    const ended: Promise<string> = new Promise<string>(resolve => fixture.terminals.onSessionEnded = resolve);
    session.end();
    assert.equal(await ended, "session-1");
    const next: ToolSession = fixture.openSession();
    const otherChat: ToolSession = fixture.openSession();
    fixture.terminals.sessionOwners.set("session-2", "example.chat/42");
    fixture.terminals.sessionOwners.set("session-3", "example.chat/7");
    const listed: JsonObject = structuredOf(await next.callAsync("terminal_list", {}));
    const read: JsonObject = structuredOf(await next.callAsync("terminal_read", { terminal_id: terminalId }));
    const ran: JsonObject = structuredOf(await next.callAsync("terminal_run", { terminal_id: terminalId, command: "pwd" }));

    assert.deepEqual([fixture.terminals.terminals[0]?.owner, fixture.terminals.terminals[0]?.closes], ["example.chat/42", 0]);
    assert.deepEqual((listed["terminals"] as JsonObject[]).map(t => t["terminal_id"]), [terminalId]);
    assert.equal(read["output"], "abc");
    assert.equal(ran["terminal_id"], terminalId);
    assert.deepEqual(structuredOf(await otherChat.callAsync("terminal_list", {}))["terminals"], []);
    assert.equal(failureOf(await otherChat.callAsync("terminal_read", { terminal_id: terminalId })).code, ToolFailureCode.Refused);
  });

  it("fails a run as Stale when the session lost its owner's terminal while the run waited for its grant, and runs nothing", async () => {
    const fixture: ToolsFixture = new ToolsFixture();
    const chat: FakeAgentTerminal = fixture.terminals.add("chat", "session-1", "example.chat/42");
    fixture.openSession();
    const next: ToolSession = fixture.openSession();
    fixture.terminals.sessionOwners.set("session-2", "example.chat/42");
    fixture.permissions.whenRaised(() => fixture.terminals.sessionOwners.delete("session-2"));
    fixture.permissions.answerNext(PermissionDecision.AllowedOnce);

    const failure: ToolFailure = failureOf(await next.callAsync("terminal_run", { terminal_id: "chat", command: "pwd" }));

    assert.equal(failure.code, ToolFailureCode.Stale);
    assert.deepEqual(chat.runs, []);
  });

  it("withdraws its tools and stops listening for session ends when disposed", () => {
    const fixture: ToolsFixture = new ToolsFixture();
    const own: FakeAgentTerminal = fixture.terminals.add("own", "session-1");
    const session: ToolSession = fixture.openSession();
    fixture.tools.dispose();
    fixture.tools.dispose();
    session.end();

    assert.deepEqual([fixture.context.tools.activeCallsOf("register"), fixture.context.tools.activeCallsOf("onSessionEnded")], [[], []]);
    assert.deepEqual(fixture.openSession().listTools(), []);
    assert.deepEqual([own.closes, fixture.terminals.endedSessions], [0, []]);
  });
});
