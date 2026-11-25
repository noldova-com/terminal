/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import { readFileSync } from "node:fs";

import { Resources } from "../resources.ts";

class ReportedTest {
  public readonly name: string;
  public readonly status: string;

  public constructor(name: string, status: string) {
    this.name = name;
    this.status = status;
  }
}

class ShellRunCheck {
  private readonly report: string;
  private readonly shells: readonly string[];

  public constructor(report: string, shells: readonly string[]) {
    this.report = report;
    this.shells = shells;
  }

  private static field(value: unknown, name: string): unknown {
    return Object.isObject(value) && !Array.isArray(value) ? Object.fromEntries(Object.entries(value))[name] : undefined;
  }

  private static list(value: unknown): readonly unknown[] {
    return Array.isArray(value) ? value : [];
  }

  public run(): readonly string[] {
    if (this.shells.length === 0)
      return [Resources.shellRunUsage];
    const tests: readonly ReportedTest[] = this.readTests();
    const problems: string[] = [];
    for (const shell of this.shells) {
      const tag: string = Resources.formatShellTag(shell);
      const named: readonly ReportedTest[] = tests.filter(t => t.name.includes(tag));
      for (const test of named)
        if (test.status !== Resources.vitestPassed)
          problems.push(Resources.formatShellTestNotPassed(shell, test.name, test.status));
      if (!named.some(t => t.status === Resources.vitestPassed))
        problems.push(Resources.formatShellUntested(shell));
      else
        console.log(Resources.formatShellTested(shell, named.length));
    }
    return problems;
  }

  private readTests(): readonly ReportedTest[] {
    const report: unknown = JSON.parse(readFileSync(this.report, Resources.textEncoding));
    const tests: ReportedTest[] = [];
    for (const file of ShellRunCheck.list(ShellRunCheck.field(report, Resources.vitestFiles)))
      for (const test of ShellRunCheck.list(ShellRunCheck.field(file, Resources.vitestTests))) {
        const name: unknown = ShellRunCheck.field(test, Resources.vitestName);
        const status: unknown = ShellRunCheck.field(test, Resources.vitestStatus);
        if (Object.isString(name) && Object.isString(status))
          tests.push(new ReportedTest(name, status));
      }
    return tests;
  }
}

const [report, ...shells] = process.argv.slice(2);
const problems: readonly string[] = Object.isUndefined(report) ? [Resources.shellRunUsage] : new ShellRunCheck(report, shells).run();
for (const problem of problems)
  console.error(problem);
process.exitCode = problems.length > 0 ? 1 : 0;
