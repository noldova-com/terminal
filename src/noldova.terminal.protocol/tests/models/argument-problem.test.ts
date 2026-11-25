/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TestClass, TestMethod } from "@noldova/context.testing";
import { ArgumentProblem } from "@noldova/terminal.protocol";

import { Expect } from "../support/expect.ts";

@TestClass
export class ArgumentProblemTests {
  @TestMethod
  public holdsTheParameterTheReasonThatNamesItAndTheMessageThatDoesnt(): void {
    const problem: ArgumentProblem = new ArgumentProblem("folder", "folder must be an absolute path.", "The value must be an absolute path.");

    Expect.same(["folder", "folder must be an absolute path.", "The value must be an absolute path."], [problem.parameterName, problem.reason, problem.message]);
  }
}
