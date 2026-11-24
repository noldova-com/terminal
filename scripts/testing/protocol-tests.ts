/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { spawnSync } from "node:child_process";
import type { SpawnSyncReturns } from "node:child_process";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";

import { CoverageAnalyzer, CoverageProject, CoverageReportWriter, type CoverageResult } from "@noldova/context.testing";

import { Resources } from "../resources.ts";

class ProtocolTests {
  private static readonly root: string = path.resolve(import.meta.dirname, "..", "..");

  public static async runAsync(values: readonly string[]): Promise<number> {
    const options: readonly string[] = values.filter(t => t.startsWith(Resources.optionPrefix));
    const filters: readonly string[] = values.filter(t => !t.startsWith(Resources.optionPrefix));
    const output: string = path.join(ProtocolTests.root, ...Resources.protocolTestOutput);
    const coverage: string = path.join(ProtocolTests.root, ...Resources.protocolCoverageOutput);
    await rm(output, { recursive: true, force: true });
    await rm(coverage, { recursive: true, force: true });
    await mkdir(coverage, { recursive: true });

    const compiled: number = ProtocolTests.run([Resources.typeScriptCompilerPath, Resources.projectOption, Resources.protocolTestProject], process.env);
    if (compiled !== 0)
      return compiled;
    const environment: NodeJS.ProcessEnv = {
      ...process.env,
      [Resources.coverageVariable]: coverage,
      [Resources.testFiltersVariable]: JSON.stringify(filters)
    };
    if (options.includes(Resources.skipTestDetails))
      environment[Resources.skipTestDetailsVariable] = Resources.enabledValue;
    const ran: number = ProtocolTests.run([Resources.sourceMapsOption, Resources.testEntryPath, Resources.protocolPackageName,
      path.join(output, Resources.compiledTestsFolder)], environment);
    if (ran !== 0 || filters.length > 0)
      return ran;

    const project: CoverageProject = new CoverageProject(Resources.protocolPackageName, path.join(output, Resources.sourceFolder),
      path.join(ProtocolTests.root, Resources.protocolFolder, Resources.sourceFolder));
    const result: CoverageResult = await new CoverageAnalyzer().analyzeAsync(coverage, [project]);
    for (const line of new CoverageReportWriter().formatLines(result, options.includes(Resources.skipCoverageDetails)))
      process.stdout.write(`${line}${Resources.lineEnd}`);
    if (result.isComplete)
      return 0;
    console.error(Resources.protocolCoverageIncomplete);
    return 1;
  }

  private static run(step: readonly string[], environment: NodeJS.ProcessEnv): number {
    const result: SpawnSyncReturns<Buffer> = spawnSync(process.execPath, step, { cwd: ProtocolTests.root, env: environment, stdio: Resources.inheritedStdio });
    if (result.error !== undefined)
      console.error(result.error.message);
    return result.status ?? 1;
  }
}

process.exitCode = await ProtocolTests.runAsync(process.argv.slice(2));
