/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import { spawnSync } from "node:child_process";
import type { SpawnSyncReturns } from "node:child_process";
import path from "node:path";

import { Resources } from "./resources.ts";

type Stage = readonly [string, readonly (readonly string[])[]];

class Test {
  private static readonly root: string = path.dirname(import.meta.dirname);
  private static readonly window: string = path.join(Test.root, Resources.windowFolder);
  private static readonly angularCli: string = path.join(Test.root, ...Resources.angularCliEntry);

  public static run(values: readonly string[]): number {
    const options: readonly string[] = values.filter(t => t.startsWith(Resources.optionPrefix));
    const unknown: readonly string[] = options.filter(t => !Resources.testOptions.includes(t));
    if (unknown.length > 0) {
      console.error(Resources.formatTestOptionsRefused(unknown));
      return 1;
    }
    const rootTests: readonly string[] = [
      ...Resources.vitestArguments,
      ...(options.includes(Resources.skipTestDetails) ? [Resources.dotReporter] : []),
      ...(options.includes(Resources.skipCoverageDetails) ? [Resources.skipFullCoverage] : [])
    ];
    const noGates: readonly string[] = Resources.coverageMetrics.map(t => Resources.formatNoCoverageGate(t));
    const filters: readonly string[] = values.filter(t => !t.startsWith(Resources.optionPrefix));
    const paths: readonly string[] = filters.map(t => t.replaceAll(Resources.windowsSeparator, Resources.posixSeparator));
    const rootFilters: readonly string[] = paths.filter(t => !t.startsWith(Resources.windowSpecPrefix) && !t.startsWith(Resources.protocolTestPrefix));
    const protocolFilters: readonly string[] = paths.filter(t => t.startsWith(Resources.protocolTestPrefix)).map(t => path.posix.basename(t, Resources.sourceExtension));
    const windowSpecs: readonly string[] = paths.filter(t => t.startsWith(Resources.windowSpecPrefix)).map(t => t.slice(Resources.windowSpecPrefix.length));
    const timedTests: readonly string[] = [...rootTests, ...(options.includes(Resources.skipTestDetails) ? [] : [Resources.defaultReporter]), ...Resources.jsonReporter];
    if (filters.length === 0)
      return Test.runStages([
        [Test.root, [...Resources.testChecks, [Resources.protocolTests, ...options], timedTests, [Resources.testTimeCheck, Resources.testTimesReport]]],
        [Test.window, [...Test.prepareSteps(), Test.unitStep([]), Test.lookStep([])]],
        [Test.root, [[Resources.installedPackageTest]]]
      ]);
    const rootSteps: (readonly string[])[] = [
      ...(protocolFilters.length === 0 ? [] : [[Resources.protocolTests, ...options, ...protocolFilters]]),
      ...(rootFilters.length === 0 ? [] : [[...rootTests, ...noGates, ...rootFilters]])
    ];
    if (windowSpecs.length === 0)
      return Test.runStages([[Test.root, [...Resources.testChecks, ...rootSteps]]]);
    return Test.runStages([[Test.root, [...Resources.testChecks, ...rootSteps]], [Test.window, Test.windowSteps(windowSpecs)]]);
  }

  private static prepareSteps(): (readonly string[])[] {
    return [
      [path.join(Test.root, ...Resources.angularCompilerEntry), ...Resources.windowTypeCheckArguments],
      [path.join(Test.root, ...Resources.playwrightEntry), ...Resources.browserInstallArguments]
    ];
  }

  private static unitStep(options: readonly string[]): readonly string[] {
    return [Test.angularCli, ...Resources.unitTestArguments, ...options];
  }

  private static lookStep(options: readonly string[]): readonly string[] {
    return [Test.angularCli, ...Resources.lookTestArguments, ...options];
  }

  private static windowSteps(specs: readonly string[]): (readonly string[])[] {
    const looks: readonly string[] = specs.filter(t => t.endsWith(Resources.lookSpecSuffix));
    const units: readonly string[] = specs.filter(t => !t.endsWith(Resources.lookSpecSuffix));
    const steps: (readonly string[])[] = Test.prepareSteps();
    if (units.length > 0)
      steps.push(Test.unitStep([Resources.noCoverageOption, ...units.flatMap(t => [Resources.includeOption, t])]));
    if (looks.length > 0)
      steps.push(Test.lookStep(looks.flatMap(t => [Resources.includeOption, t])));
    return steps;
  }

  private static runStages(stages: readonly Stage[]): number {
    for (const [folder, steps] of stages)
      for (const step of steps) {
        const result: SpawnSyncReturns<string | Buffer> = spawnSync(process.execPath, step, { cwd: folder, stdio: Resources.inheritedStdio });
        if (!Object.isUndefined(result.error))
          console.error(result.error.message);
        if (result.status !== 0)
          return result.status ?? 1;
      }
    return 0;
  }
}

process.exitCode = Test.run(process.argv.slice(2));
