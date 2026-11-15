/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { Resources } from "../resources.ts";

export class TestWaitCheck {
  private readonly root: string;

  public constructor(root: string) {
    this.root = root;
  }

  public run(): readonly string[] {
    const listed: ReadonlyMap<string, number> = this.readList();
    const testFiles: readonly string[] = this.listFiles(Resources.testWaitSourceFolders).filter(t => TestWaitCheck.isTestFile(t));
    const pausing: Set<string> = new Set<string>();
    const findings: string[] = [];
    for (const file of testFiles) {
      const lines: readonly number[] = TestWaitCheck.findPauses(readFileSync(path.join(this.root, file), Resources.textEncoding));
      if (lines.length > 0)
        pausing.add(file);
      if (!listed.has(file))
        findings.push(...lines.map(t => Resources.formatTestWaitPause(file, t)));
    }
    for (const [file, line] of listed)
      if (!pausing.has(file))
        findings.push(Resources.formatTestWaitStale(line, file));
    console.log(Resources.formatTestWaitChecked(testFiles.length, listed.size));
    return findings;
  }

  private listFiles(folders: readonly string[]): readonly string[] {
    const files: string[] = [];
    const pending: string[] = [...folders];
    for (let folder = pending.pop(); folder !== undefined; folder = pending.pop())
      for (const entry of readdirSync(path.join(this.root, folder), { withFileTypes: true })) {
        const file: string = `${folder}${Resources.posixSeparator}${entry.name}`;
        if (entry.isDirectory() && !Resources.testWaitSkippedFolders.has(entry.name))
          pending.push(file);
        else if (entry.isFile())
          files.push(file);
      }
    return files.sort();
  }

  private static isTestFile(file: string): boolean {
    if (!Resources.testWaitExtensions.has(path.posix.extname(file)))
      return false;
    return file.endsWith(Resources.testWaitSpecSuffix) || file.split(Resources.posixSeparator).some(t => Resources.testWaitTestFolders.has(t));
  }

  private static findPauses(text: string): readonly number[] {
    const lines: Set<number> = new Set<number>();
    for (const pattern of Resources.testWaitPauses)
      for (const match of text.matchAll(pattern))
        if (!TestWaitCheck.isInString(text, match.index))
          lines.add(text.slice(0, match.index).split(Resources.lineEnd).length);
    return [...lines].sort((a, b) => a - b);
  }

  private static isInString(text: string, index: number): boolean {
    const lineStart: number = text.lastIndexOf(Resources.lineEnd, index - 1) + 1;
    let quote: string | null = null;
    for (let position = lineStart; position < index; position++) {
      const character: string = text.charAt(position);
      if (quote === null) {
        if (Resources.testWaitQuotes.includes(character))
          quote = character;
      }
      else if (character === Resources.testWaitEscape)
        position++;
      else if (character === quote)
        quote = null;
    }
    return quote !== null;
  }

  private readList(): ReadonlyMap<string, number> {
    const lines: readonly string[] = readFileSync(path.join(this.root, Resources.readmeFile), Resources.textEncoding).split(Resources.lineEnd);
    const start: number = lines.indexOf(Resources.testWaitListHeader);
    const files: Map<string, number> = new Map<string, number>();
    if (start === -1)
      return files;
    for (const [offset, line] of lines.slice(start + 2).entries()) {
      if (!line.startsWith(Resources.testWaitTableRowPrefix))
        break;
      const file: string | undefined = Resources.testWaitListRow.exec(line)?.[1];
      if (file !== undefined)
        files.set(file, start + offset + 3);
    }
    return files;
  }
}

const findings: readonly string[] = new TestWaitCheck(process.cwd()).run();
for (const finding of findings)
  console.error(finding);
process.exitCode = findings.length > 0 ? 1 : 0;
