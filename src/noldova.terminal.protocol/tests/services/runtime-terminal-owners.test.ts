/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { RuntimeTerminalOwners as ExportedTerminalOwners } from "../../src/api/index.ts";
import { Resources } from "../../src/resources.ts";
import { RuntimeTerminalOwners } from "../../src/services/runtime-terminal-owners.ts";

const BRAND: symbol = Symbol.for("@noldova/terminal.protocol/RuntimeTerminalOwners");
const COPIES: string = "The terminal.owners service comes from another installed copy of @noldova/terminal.protocol: "
  + "install one copy, at Terminal's version, so that RuntimeTerminalOwners matches it.";

class RecordingOwners extends RuntimeTerminalOwners {
  public readonly calls: string[] = [];

  public override closeAsync(owner: string): Promise<void> {
    this.calls.push(`close ${owner}`);
    return Promise.resolve();
  }

  public override bindAgentSession(agentSessionId: string, owner: string): void {
    this.calls.push(`bind ${agentSessionId} ${owner}`);
  }

  public override unbindAgentSession(agentSessionId: string): void {
    this.calls.push(`unbind ${agentSessionId}`);
  }
}

class OtherOwners extends RuntimeTerminalOwners {
  public override closeAsync(): Promise<void> {
    return Promise.resolve();
  }

  public override bindAgentSession(): void {}

  public override unbindAgentSession(): void {}
}

describe("RuntimeTerminalOwners", () => {
  it("is the class the package exports, so a service that extends it passes a check against the export", async () => {
    const owners: RecordingOwners = new RecordingOwners();

    owners.bindAgentSession("session-1", "example.chat/42");
    owners.unbindAgentSession("session-1");
    await owners.closeAsync("example.chat/42");

    assert.equal(ExportedTerminalOwners, RuntimeTerminalOwners);
    assert.ok(owners instanceof ExportedTerminalOwners);
    assert.deepEqual(owners.calls, ["bind session-1 example.chat/42", "unbind session-1", "close example.chat/42"]);
  });

  it("names another installed copy of the package when a check meets its service, and tells an object of another kind from an instance", () => {
    const fromAnotherCopy: object = { [BRAND]: true };

    const others: readonly unknown[] = [{}, null, "owners", new Error("other")];

    assert.throws(() => fromAnotherCopy instanceof RuntimeTerminalOwners, { name: "PackageCopiesException", message: COPIES });
    assert.deepEqual(others.map(t => t instanceof RuntimeTerminalOwners), [false, false, false, false]);
    assert.equal(new RecordingOwners() instanceof RecordingOwners, true);
    assert.throws(() => fromAnotherCopy instanceof RecordingOwners, { name: "PackageCopiesException", message: COPIES });
    assert.equal(Resources.runtimeOwnersCopies, COPIES);
  });

  it("tells an instance of another subclass from the same copy from one of the subclass checked, without naming copies", () => {
    const owners: RecordingOwners = new RecordingOwners();

    assert.equal(owners instanceof OtherOwners, false);
    assert.equal(new OtherOwners() instanceof RecordingOwners, false);
    assert.equal(new OtherOwners() instanceof RuntimeTerminalOwners, true);
  });

  it("keeps the brand on the prototype, so a copy of a service's fields isn't taken for another copy's service", () => {
    const owners: RecordingOwners = new RecordingOwners();
    const fields: object = { ...owners };

    assert.equal(BRAND in owners, true);
    assert.equal(Object.getOwnPropertyDescriptor(RuntimeTerminalOwners.prototype, BRAND)?.get?.call(owners), true);
    assert.equal(Object.hasOwn(owners, BRAND), false);
    assert.equal(fields instanceof RuntimeTerminalOwners, false);
  });
});
