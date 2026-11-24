/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Exception } from "@noldova/context.exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { PackageCopiesException } from "../../src/exceptions/package-copies.exception.ts";
import { TerminalProtocolException } from "../../src/exceptions/terminal-protocol.exception.ts";

@TestClass
export class PackageCopiesExceptionTests {
  @TestMethod
  public carriesItsNameAndFormatsItsOwnMessageWhichNamesThePackageAndWhatToInstall(): void {
    const error: PackageCopiesException = new PackageCopiesException();

    Assert.isTrue(error instanceof TerminalProtocolException);
    Assert.isTrue(error instanceof Exception);
    Assert.areEqual("PackageCopiesException", error.name);
    Assert.areEqual("The terminal.owners service comes from another installed copy of @noldova/terminal.protocol: "
      + "install one copy, at Terminal's version, so that RuntimeTerminalOwners matches it.", error.message);
  }
}
