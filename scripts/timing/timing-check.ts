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
import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { Resources } from "../resources.ts";

class TimingCheck {
  private static readonly root: string = path.dirname(path.dirname(import.meta.dirname));
  private static readonly window: string = path.join(TimingCheck.root, Resources.windowFolder);
  private static readonly folder: string = path.join(TimingCheck.root, ...Resources.timingFolder);

  private readonly fileTimes: Map<string, number[]> = new Map<string, number[]>();
  private readonly testTimes: Map<string, Map<string, number[]>> = new Map<string, Map<string, number[]>>();

  private static field(value: unknown, name: string): unknown {
    return Object.isObject(value) && !Array.isArray(value) ? Object.fromEntries(Object.entries(value))[name] : undefined;
  }

  private static list(value: unknown): readonly unknown[] {
    return Array.isArray(value) ? value : [];
  }

  private static median(values: readonly number[]): number {
    const sorted: readonly number[] = [...values].sort((a, b) => a - b);
    const middle: number = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 1 ? sorted[middle] ?? 0 : ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
  }

  private static relative(file: string): string {
    return path.relative(TimingCheck.root, file).replaceAll(Resources.windowsSeparator, Resources.posixSeparator);
  }

  private static spawn(folder: string, step: readonly string[]): number {
    const result: SpawnSyncReturns<string | Buffer> = spawnSync(process.execPath, step, { cwd: folder, stdio: Resources.inheritedStdio });
    if (!Object.isUndefined(result.error))
      console.error(result.error.message);
    return result.status ?? 1;
  }

  private static readAccepted(lines: readonly string[], header: string): ReadonlySet<string> | undefined {
    const start: number = lines.indexOf(header);
    if (start === -1)
      return undefined;
    const files: Set<string> = new Set<string>();
    for (const line of lines.slice(start + 2)) {
      if (!line.startsWith(Resources.testWaitTableRowPrefix))
        break;
      const file: string | undefined = Resources.slowFileListRow.exec(line)?.[1];
      if (!Object.isUndefined(file))
        files.add(file);
    }
    return files;
  }

  public run(): number {
    mkdirSync(TimingCheck.folder, { recursive: true });
    for (let run = 1; run <= Resources.timingRuns; run++) {
      const unitReport: string = path.join(TimingCheck.folder, Resources.formatTimingReport(Resources.unitTimingName, run));
      const unitStatus: number = TimingCheck.spawn(TimingCheck.root, [...Resources.unitTimingArguments, `${Resources.outputFileJsonOption}${unitReport}`]);
      if (unitStatus !== 0)
        return unitStatus;
      this.readUnit(unitReport);
      const specReport: string = path.join(TimingCheck.folder, Resources.formatTimingReport(Resources.specTimingName, run));
      const specStatus: number = TimingCheck.spawn(TimingCheck.window,
        [path.join(TimingCheck.root, ...Resources.angularCliEntry), ...Resources.specTimingArguments, specReport]);
      if (specStatus !== 0)
        return specStatus;
      this.readSpecs(specReport);
      const lookReport: string = path.join(TimingCheck.folder, Resources.formatTimingReport(Resources.lookTimingName, run));
      const lookStatus: number = TimingCheck.spawn(TimingCheck.window,
        [path.join(TimingCheck.root, ...Resources.angularCliEntry), ...Resources.lookTimingArguments, lookReport]);
      if (lookStatus !== 0)
        return lookStatus;
      this.readSpecs(lookReport);
    }
    const protocolStatus: number = TimingCheck.spawn(TimingCheck.root, [Resources.protocolTiming]);
    if (protocolStatus !== 0)
      return protocolStatus;
    const problems: readonly string[] = [
      ...this.fileTimes.size === 0 ? [Resources.formatNothingTimed(Resources.unitTimingName)] : [],
      ...this.testTimes.size === 0 ? [Resources.formatNothingTimed(Resources.specTimingName)] : []
    ];
    const lines: readonly string[] = readFileSync(path.join(TimingCheck.root, Resources.readmeFile), Resources.textEncoding).split(Resources.lineEnd);
    const acceptedFiles: ReadonlySet<string> | undefined = TimingCheck.readAccepted(lines, Resources.slowFileListHeader);
    const acceptedSpecs: ReadonlySet<string> | undefined = TimingCheck.readAccepted(lines, Resources.slowSpecListHeader);
    for (const [header, accepted] of [[Resources.slowFileListHeader, acceptedFiles], [Resources.slowSpecListHeader, acceptedSpecs]] as const)
      if (Object.isUndefined(accepted))
        console.error(Resources.formatTimingListMissing(header));
    for (const problem of problems)
      console.error(problem);
    if (problems.length > 0 || Object.isUndefined(acceptedFiles) || Object.isUndefined(acceptedSpecs))
      return 1;
    const slowFiles: number = this.reportUnitFiles(acceptedFiles);
    const slowSpecs: number = this.reportSpecs(acceptedSpecs);
    console.log(Resources.formatTimingSummary(slowFiles, slowSpecs));
    return slowFiles + slowSpecs > 0 ? 1 : 0;
  }

  private files(report: string): readonly unknown[] {
    return TimingCheck.list(TimingCheck.field(JSON.parse(readFileSync(report, Resources.textEncoding)), Resources.vitestFiles));
  }

  private readUnit(report: string): void {
    for (const file of this.files(report)) {
      const name: unknown = TimingCheck.field(file, Resources.vitestFileName);
      const start: unknown = TimingCheck.field(file, Resources.vitestStartTime);
      const end: unknown = TimingCheck.field(file, Resources.vitestEndTime);
      if (!Object.isString(name) || !Object.isNumber(start) || !Object.isNumber(end))
        continue;
      const relative: string = TimingCheck.relative(name);
      this.fileTimes.set(relative, [...this.fileTimes.get(relative) ?? [], end - start]);
    }
  }

  private readSpecs(report: string): void {
    for (const file of this.files(report)) {
      const name: unknown = TimingCheck.field(file, Resources.vitestFileName);
      if (!Object.isString(name))
        continue;
      const relative: string = TimingCheck.relative(name);
      const tests: Map<string, number[]> = this.testTimes.get(relative) ?? new Map<string, number[]>();
      for (const test of TimingCheck.list(TimingCheck.field(file, Resources.vitestTests))) {
        const title: unknown = TimingCheck.field(test, Resources.vitestName);
        const duration: unknown = TimingCheck.field(test, Resources.vitestDuration);
        if (Object.isString(title) && Object.isNumber(duration))
          tests.set(title, [...tests.get(title) ?? [], duration]);
      }
      this.testTimes.set(relative, tests);
    }
  }

  private reportUnitFiles(accepted: ReadonlySet<string>): number {
    let slow: number = 0;
    for (const [file, times] of [...this.fileTimes].sort(([left], [right]) => left.localeCompare(right))) {
      const time: number = TimingCheck.median(times);
      if (time <= Resources.unitFileBudget * Resources.timingMargin)
        continue;
      const isAccepted: boolean = accepted.has(file);
      slow += Number(!isAccepted);
      console.log(Resources.formatUnitFileTiming(file, time, isAccepted));
    }
    return slow;
  }

  private reportSpecs(accepted: ReadonlySet<string>): number {
    let slow: number = 0;
    for (const [file, tests] of [...this.testTimes].sort(([left], [right]) => left.localeCompare(right))) {
      const medians: readonly number[] = [...tests.values()].map(t => TimingCheck.median(t));
      const median: number = TimingCheck.median(medians);
      const isOver: boolean = median > Resources.specMedianBudget * Resources.timingMargin;
      const isAccepted: boolean = accepted.has(file);
      slow += Number(isOver && !isAccepted);
      console.log(Resources.formatSpecMedian(file, median, tests.size, isOver, isAccepted));
      for (const [title, times] of tests) {
        const time: number = TimingCheck.median(times);
        if (time > Resources.slowComponentTest)
          console.log(Resources.formatSlowComponentTest(file, title, time));
      }
    }
    return slow;
  }
}

process.exitCode = new TimingCheck().run();
