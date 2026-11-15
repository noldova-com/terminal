/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { type IPermissionRequest, PermissionDecision, PermissionDetailKind, ToolAbortReason, type ToolFailure, ToolFailureCode,
  ToolRisk } from "@noldova/desktop.runtime";
import { describe, it } from "vitest";

import { PermissionAsk } from "../../../src/tools/models/permission-ask.ts";
import { PermissionGate } from "../../../src/tools/services/permission-gate.ts";
import { FakePermissionRequests } from "../../fixtures/fake-permission-requests.fixture.ts";
import { createContext } from "../../fixtures/tool-call-contexts.fixture.ts";
import { ToolHarness } from "../../fixtures/tool-harness.fixture.ts";

const ASK: PermissionAsk = new PermissionAsk("terminal_run", "run", "Run a command in a terminal", ToolRisk.High,
  [{ label: "Command", kind: PermissionDetailKind.Code, value: "ls" }], "sha256:0");

const CANCELLED: string = "terminal_run did not run: the call ended before it acted.";

async function assertFailsAsync(action: Promise<void>, code: ToolFailureCode, message: string): Promise<void> {
  const failure: ToolFailure = await ToolHarness.assertFailsAsync(action, code, null);
  assert.equal(failure.message, message);
}

describe("PermissionGate", () => {
  for (const decision of [PermissionDecision.AllowedOnce, PermissionDecision.AllowedAlways])
    it(`raises the ask's request once, through its call, and passes on ${decision}`, async () => {
      const requests: FakePermissionRequests = new FakePermissionRequests();
      requests.answerNext(decision);
      await new PermissionGate().requireGrantAsync(ASK, createContext(undefined, [], requests));

      assert.deepEqual(requests.requests, [ASK.request]);
    });

  for (const [decision, code] of [[PermissionDecision.Denied, ToolFailureCode.Denied], [PermissionDecision.DeniedAlways, ToolFailureCode.Denied],
    [PermissionDecision.Expired, ToolFailureCode.Expired], [PermissionDecision.Withdrawn, ToolFailureCode.Withdrawn],
    [PermissionDecision.TakenOver, ToolFailureCode.Denied]] as const)
    it(`fails as ${code} when the request ends as ${decision}`, async () => {
      const requests: FakePermissionRequests = new FakePermissionRequests();
      requests.answerNext(decision);

      await assertFailsAsync(new PermissionGate().requireGrantAsync(ASK, createContext(undefined, [], requests)), code,
        `terminal_run did not run: its permission request ended as ${decision}.`);
    });

  it("fails as Denied when the call carries no permissions, as Noldova Desktop's call does then", async () => {
    await assertFailsAsync(new PermissionGate().requireGrantAsync(ASK, createContext()), ToolFailureCode.Denied, "terminal_run did not run: its permission request ended as Denied.");
  });

  it("raises details of up to 80 KiB as JSON, and refuses longer ones before raising them", async () => {
    const requests: FakePermissionRequests = new FakePermissionRequests();
    requests.answerNext(PermissionDecision.AllowedOnce);
    const detail = (value: string): PermissionAsk => new PermissionAsk("terminal_run", "run", "Run", ToolRisk.High, [{ label: "C", kind: PermissionDetailKind.Code, value }], "s");
    const fits: string = "é".repeat((81_920 - JSON.stringify([{ label: "C", kind: "Code", value: "" }]).length) / 2);

    await new PermissionGate().requireGrantAsync(detail(fits), createContext(undefined, [], requests));
    const failure: ToolFailure = await ToolHarness.assertFailsAsync(
      new PermissionGate().requireGrantAsync(detail(`${fits}a`), createContext(undefined, [], requests)), ToolFailureCode.Refused, "terminal.requestTooLarge");

    assert.equal(failure.message, "terminal_run did not run: its permission request can't show its exact input, which is more than 81920 bytes as JSON.");
    assert.deepEqual(requests.requests.map((t: IPermissionRequest) => t.details[0]?.value.length), [fits.length]);
  });

  it("withdraws a request nobody answered when the call ends", async () => {
    const requests: FakePermissionRequests = new FakePermissionRequests();
    const controller: AbortController = new AbortController();
    requests.whenRaised(() => controller.abort(ToolAbortReason.Cancelled));

    await assertFailsAsync(new PermissionGate().requireGrantAsync(ASK, createContext(controller.signal, [], requests)), ToolFailureCode.Withdrawn,
      "terminal_run did not run: its permission request ended as Withdrawn.");
  });

  it("raises nothing for a call that already ended, which fails as cancelled", async () => {
    const requests: FakePermissionRequests = new FakePermissionRequests();
    const controller: AbortController = new AbortController();
    controller.abort(ToolAbortReason.Cancelled);

    await assertFailsAsync(new PermissionGate().requireGrantAsync(ASK, createContext(controller.signal, [], requests)), ToolFailureCode.Cancelled, CANCELLED);
    assert.equal(requests.requests.length, 0);
  });

  it("acts on no grant that arrives after the call ended, which fails as what ended it", async () => {
    const requests: FakePermissionRequests = new FakePermissionRequests();
    const controller: AbortController = new AbortController();
    requests.answerNext(PermissionDecision.AllowedOnce);
    requests.whenRaised(() => controller.abort(ToolAbortReason.DeadlineReached));

    await assertFailsAsync(new PermissionGate().requireGrantAsync(ASK, createContext(controller.signal, [], requests)), ToolFailureCode.TimedOut, CANCELLED);
  });
});
