/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import Config from "./config.ts";
import Script from "./script.ts";
import TestProject from "./test-project.ts";

export default abstract class SuiteScript extends Script {
  protected static readonly HANG_LIMIT_MILLISECONDS: number = 60_000;
  protected static readonly FILTERS_VARIABLE: string = "CONTEXT_TEST_FILTERS";
  protected static readonly RESULTS_FILE_VARIABLE: string = "CONTEXT_TEST_RESULTS_FILE";
  protected static readonly TIMEOUT_VARIABLE: string = "CONTEXT_TEST_TIMEOUT_MILLISECONDS";
  private static readonly SOURCE_MAPS_OPTION: string = "--enable-source-maps";
  private static readonly TEST_ENTRY_PATH: string = "node_modules/@noldova/context.testing/services/execution/test-run-entry-point.js";

  protected async listTestProjectsAsync(): Promise<TestProject[]> {
    const projects: TestProject[] = [];
    for (const packageInfo of Config.PACKAGES_INFO) {
      const project = new TestProject(packageInfo.name, `${SuiteScript.SOURCE_DIRECTORY_NAME}/${packageInfo.path}`);
      if (await this.pathExistsAsync(project.tsconfigPath))
        projects.push(project);
    }
    return projects;
  }

  protected async runSuiteAsync(projects: readonly TestProject[], environment: Record<string, string>): Promise<void> {
    environment[SuiteScript.TIMEOUT_VARIABLE] = String(SuiteScript.HANG_LIMIT_MILLISECONDS);
    await this.executeProcessAsync(
      process.execPath,
      [SuiteScript.SOURCE_MAPS_OPTION, SuiteScript.TEST_ENTRY_PATH, ...projects.flatMap(t => [t.name, t.buildDirectory])],
      process.cwd(),
      false,
      environment);
  }
}
