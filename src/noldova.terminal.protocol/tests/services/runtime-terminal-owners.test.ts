/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { RuntimeTerminalOwners as ExportedTerminalOwners } from "../../src/api/index.ts";
import { Resources } from "../../src/resources.ts";
import { RuntimeTerminalOwners } from "../../src/services/runtime-terminal-owners.ts";
import { Expect } from "../support/expect.ts";

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

@TestClass
export class RuntimeTerminalOwnersTests {
  @TestMethod
  public async isTheClassThePackageExportsSoAServiceThatExtendsItPassesACheckAgainstTheExport(): Promise<void> {
    const owners: RecordingOwners = new RecordingOwners();

    owners.bindAgentSession("session-1", "example.chat/42");
    owners.unbindAgentSession("session-1");
    await owners.closeAsync("example.chat/42");

    Assert.areEqual(RuntimeTerminalOwners, ExportedTerminalOwners);
    Assert.isTrue(owners instanceof ExportedTerminalOwners);
    Expect.same(["bind session-1 example.chat/42", "unbind session-1", "close example.chat/42"], owners.calls);
  }

  @TestMethod
  public namesAnotherInstalledCopyOfThePackageWhenACheckMeetsItsServiceAndTellsAnObjectOfAnotherKindFromAnInstance(): void {
    const fromAnotherCopy: object = { [BRAND]: true };

    const others: readonly unknown[] = [{}, null, "owners", new Error("other")];

    Expect.throwsMatching(() => fromAnotherCopy instanceof RuntimeTerminalOwners, { name: "PackageCopiesException", message: COPIES });
    Expect.same([false, false, false, false], others.map(t => t instanceof RuntimeTerminalOwners));
    Assert.areEqual(true, new RecordingOwners() instanceof RecordingOwners);
    Expect.throwsMatching(() => fromAnotherCopy instanceof RecordingOwners, { name: "PackageCopiesException", message: COPIES });
    Assert.areEqual(COPIES, Resources.runtimeOwnersCopies);
  }

  @TestMethod
  public tellsAnInstanceOfAnotherSubclassFromTheSameCopyFromOneOfTheSubclassCheckedWithoutNamingCopies(): void {
    const owners: RecordingOwners = new RecordingOwners();

    Assert.areEqual(false, owners instanceof OtherOwners);
    Assert.areEqual(false, new OtherOwners() instanceof RecordingOwners);
    Assert.areEqual(true, new OtherOwners() instanceof RuntimeTerminalOwners);
  }

  @TestMethod
  public keepsTheBrandOnThePrototypeSoACopyOfAServicesFieldsIsntTakenForAnotherCopysService(): void {
    const owners: RecordingOwners = new RecordingOwners();
    const fields: object = { ...owners };

    Assert.areEqual(true, BRAND in owners);
    Assert.areEqual(true, Object.getOwnPropertyDescriptor(RuntimeTerminalOwners.prototype, BRAND)?.get?.call(owners));
    Assert.areEqual(false, Object.hasOwn(owners, BRAND));
    Assert.areEqual(false, fields instanceof RuntimeTerminalOwners);
  }
}
