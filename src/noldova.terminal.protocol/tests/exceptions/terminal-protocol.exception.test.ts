/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Exception, ExceptionOptions } from "@noldova/context.exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { TerminalProtocolException } from "@noldova/terminal.protocol";

@TestClass
export class TerminalProtocolExceptionTests {
  @TestMethod
  public carriesItsNameAndMessageAsAContextException(): void {
    const error: TerminalProtocolException = new TerminalProtocolException("The protocol failed.");

    Assert.isTrue(error instanceof Exception);
    Assert.areEqual("TerminalProtocolException", error.name);
    Assert.areEqual("The protocol failed.", error.message);
    Assert.areEqual(undefined, error.cause);
  }

  @TestMethod
  public keepsTheCauseItIsGivenThroughExceptionOptions(): void {
    const cause: Error = new Error("The stream closed.");

    const error: TerminalProtocolException = new TerminalProtocolException("The protocol failed.", new ExceptionOptions(cause));

    Assert.areEqual("The protocol failed.", error.message);
    Assert.areEqual(cause, error.cause);
  }
}
