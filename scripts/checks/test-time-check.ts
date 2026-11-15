/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { readFileSync } from "node:fs";
import path from "node:path";

import { Resources } from "../resources.ts";

class TestTimeCheck {
  private readonly root: string;
  private readonly report: string;

  public constructor(root: string, report: string) {
    this.root = root;
    this.report = report;
  }

  private static field(value: unknown, name: string): unknown {
    return typeof value === "object" && value !== null && !Array.isArray(value) ? Object.fromEntries(Object.entries(value))[name] : undefined;
  }

  public run(): readonly string[] {
    const accepted: ReadonlySet<string> = this.readAccepted();
    const report: unknown = JSON.parse(readFileSync(path.join(this.root, this.report), Resources.textEncoding));
    const files: unknown = TestTimeCheck.field(report, Resources.vitestFiles);
    const over: string[] = [];
    let accepts: number = 0;
    let measured: number = 0;
    for (const file of Array.isArray(files) ? files : []) {
      const name: unknown = TestTimeCheck.field(file, Resources.vitestFileName);
      const start: unknown = TestTimeCheck.field(file, Resources.vitestStartTime);
      const end: unknown = TestTimeCheck.field(file, Resources.vitestEndTime);
      if (typeof name !== "string" || typeof start !== "number" || typeof end !== "number")
        continue;
      measured++;
      const relative: string = path.relative(this.root, name).replaceAll(Resources.windowsSeparator, Resources.posixSeparator);
      const time: number = end - start;
      if (time <= Resources.unitFileBudget)
        continue;
      over.push(Resources.formatTestFileSlow(relative, time));
      accepts += Number(accepted.has(relative));
    }
    for (const line of over)
      console.log(line);
    console.log(Resources.formatTestTimesChecked(measured, over.length, accepts));
    return measured === 0 ? [Resources.formatNothingTimed(this.report)] : [];
  }

  private readAccepted(): ReadonlySet<string> {
    const lines: readonly string[] = readFileSync(path.join(this.root, Resources.readmeFile), Resources.textEncoding).split(Resources.lineEnd);
    const start: number = lines.indexOf(Resources.slowFileListHeader);
    const files: Set<string> = new Set<string>();
    if (start === -1)
      return files;
    for (const line of lines.slice(start + 2)) {
      if (!line.startsWith(Resources.testWaitTableRowPrefix))
        break;
      const file: string | undefined = Resources.slowFileListRow.exec(line)?.[1];
      if (file !== undefined)
        files.add(file);
    }
    return files;
  }
}

const [report] = process.argv.slice(2);
const findings: readonly string[] = report === undefined ? [Resources.testTimeUsage] : new TestTimeCheck(process.cwd(), report).run();
for (const finding of findings)
  console.error(finding);
process.exitCode = findings.length > 0 ? 1 : 0;
