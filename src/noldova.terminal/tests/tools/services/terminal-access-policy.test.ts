/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { ToolFailureCode } from "@noldova/desktop.runtime";
import { describe, it } from "vitest";

import type { AgentTerminalAccess } from "../../../src/tools/models/agent-terminal-access.ts";
import { TerminalAccessPolicy } from "../../../src/tools/services/terminal-access-policy.ts";
import { FakeAgentTerminals } from "../../fixtures/fake-agent-terminals.fixture.ts";
import { createContext, createOwnedContext } from "../../fixtures/tool-call-contexts.fixture.ts";
import { ToolHarness } from "../../fixtures/tool-harness.fixture.ts";

function createTerminals(): FakeAgentTerminals {
  const terminals: FakeAgentTerminals = new FakeAgentTerminals();
  terminals.add("own", "session-1");
  terminals.add("shared", null);
  terminals.add("persons", null);
  terminals.add("others", "session-2");
  terminals.add("others-shared", "session-2");
  terminals.add("chat", "session-2", "example.chat/42");
  terminals.add("persons-chat", null, "example.chat/42");
  return terminals;
}

describe("TerminalAccessPolicy", () => {
  const policy: TerminalAccessPolicy = new TerminalAccessPolicy(createTerminals());

  it("resolves a terminal the session opened as its own", () => {
    const access: AgentTerminalAccess = policy.resolve("own", createContext());

    assert.equal(access.terminal.id, "own");
    assert.equal(access.isShared, false);
  });

  it("resolves a terminal the person shared with the session as shared", () => {
    assert.equal(policy.resolve("shared", createContext(undefined, ["shared"])).isShared, true);
    assert.equal(policy.resolve("others-shared", createContext(undefined, ["others-shared"])).isShared, true);
  });

  for (const id of ["persons", "others", "chat", "persons-chat", "missing"]) {
    it(`refuses ${id} the same way, so it can't tell one from another`, () => {
      assert.equal(
        ToolHarness.assertThrowsFailure(() => policy.resolve(id, createContext(undefined, ["shared"])), ToolFailureCode.Refused, "terminal.notFound").message,
        `No terminal ${id} that this session opened or that the person shared with it. terminal_list lists them.`);
    });
  }

  it("lists only the session's own and shared terminals", () => {
    assert.deepEqual(policy.list(createContext(undefined, ["shared", "missing"])).map(t => [t.terminal.id, t.isShared]), [["own", false], ["shared", true]]);
  });

  it("keeps an access the session still has once its grant came, and fails one it lost or whose kind changed meanwhile as Stale", () => {
    const changing: FakeAgentTerminals = new FakeAgentTerminals();
    changing.add("own", "session-1");
    changing.add("chat", "session-2", "example.chat/42");
    const changingPolicy: TerminalAccessPolicy = new TerminalAccessPolicy(changing);
    changing.sessionOwners.set("session-1", "example.chat/42");
    const own: AgentTerminalAccess = changingPolicy.resolve("own", createContext());
    const bound: AgentTerminalAccess = changingPolicy.resolve("chat", createContext());
    const shared: AgentTerminalAccess = changingPolicy.resolve("chat", createContext(undefined, ["chat"]));
    changingPolicy.requireStill(bound, createContext());

    changing.sessionOwners.delete("session-1");
    changing.terminals.splice(0, 1);

    for (const [access, context] of [[bound, createContext()], [shared, createContext(undefined, ["chat"])], [own, createContext()]] as const)
      assert.equal(
        ToolHarness.assertThrowsFailure(() => changingPolicy.requireStill(access, context), ToolFailureCode.Stale, "terminal.stale").message,
        `Terminal ${access.terminal.id} changed after the person allowed the action, so nothing was sent.`);
  });

  it("lists the terminals that close with a session: those it opened without an owner", () => {
    assert.deepEqual(policy.listClosingWith("session-2").map(t => t.id), ["others", "others-shared"]);
  });

  it("reaches the agents' terminals of the owner the app bound the session to, but not the person's own of that owner", () => {
    const terminals: FakeAgentTerminals = createTerminals();
    const bound: TerminalAccessPolicy = new TerminalAccessPolicy(terminals);
    terminals.sessionOwners.set("session-1", "example.chat/42");

    assert.equal(bound.resolve("chat", createContext()).isShared, false);
    assert.deepEqual(bound.list(createContext()).map(t => t.terminal.id), ["own", "chat"]);
    ToolHarness.assertThrowsFailure(() => bound.resolve("persons-chat", createContext()), ToolFailureCode.Refused, "terminal.notFound");
    terminals.sessionOwners.set("session-1", "example.chat/7");
    ToolHarness.assertThrowsFailure(() => bound.resolve("chat", createContext()), ToolFailureCode.Refused, "terminal.notFound");
    assert.deepEqual(bound.list(createContext()).map(t => t.terminal.id), ["own"]);
  });

  it("reaches the agents' terminals of the owner the session's binding names, unless the app bound the session to another owner", () => {
    const terminals: FakeAgentTerminals = createTerminals();
    const owned: TerminalAccessPolicy = new TerminalAccessPolicy(terminals);

    assert.deepEqual(owned.list(createOwnedContext("example.chat/42")).map(t => t.terminal.id), ["own", "chat"]);
    ToolHarness.assertThrowsFailure(() => owned.resolve("persons-chat", createOwnedContext("example.chat/42")), ToolFailureCode.Refused, "terminal.notFound");
    assert.equal(owned.resolve("chat", createOwnedContext("example.chat/42")).isShared, false);
    terminals.sessionOwners.set("session-1", "example.chat/7");
    ToolHarness.assertThrowsFailure(() => owned.resolve("chat", createOwnedContext("example.chat/42")), ToolFailureCode.Refused, "terminal.notFound");
    assert.deepEqual(owned.list(createOwnedContext("example.chat/42")).map(t => t.terminal.id), ["own"]);
  });
});
