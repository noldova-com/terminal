/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import path from "node:path";
import type { Writable } from "node:stream";

import { CdkListFailedException } from "../exceptions/cdk-list-failed.exception.ts";
import { CdkListUnreadableException } from "../exceptions/cdk-list-unreadable.exception.ts";
import { Resources } from "../resources.ts";
import type { NpmCommand } from "../services/npm-command.ts";

export class CdkCopyCheck {
  private readonly root: string;
  private readonly folder: string;
  private readonly npm: NpmCommand;

  public constructor(root: string, folder: string, npm: NpmCommand) {
    this.root = root;
    this.folder = folder;
    this.npm = npm;
  }

  public async runAsync(output: Writable): Promise<boolean> {
    const result = await this.npm.runAsync(Resources.cdkListArguments, path.join(this.root, ...this.folder.split(Resources.posixSeparator)));
    let tree: unknown;
    try {
      tree = JSON.parse(result.output);
    }
    catch (error) {
      throw new CdkListUnreadableException(this.folder, result.text, error);
    }
    const failure = CdkCopyCheck.field(tree, Resources.npmListError);
    const code = CdkCopyCheck.field(failure, Resources.npmListCode);
    if (failure !== undefined && code !== Resources.npmListProblemsCode)
      throw new CdkListFailedException(this.folder, String(code), String(CdkCopyCheck.field(failure, Resources.npmListSummary)));
    const copies = new Map<string, string>();
    CdkCopyCheck.collect(tree, copies);
    if (copies.size === 0) {
      output.write(Resources.formatCdkCopyMissing(this.folder));
      return false;
    }
    if (copies.size === 1) {
      output.write(Resources.formatCdkCopyFound(this.folder));
      return true;
    }
    output.write(Resources.formatCdkCopiesFound(this.folder, copies.size));
    for (const [folder, version] of [...copies].sort(([left], [right]) => left.localeCompare(right)))
      output.write(Resources.formatCdkCopy(version, path.relative(this.root, folder).replaceAll(Resources.windowsSeparator, Resources.posixSeparator)));
    output.write(Resources.cdkOneCopyAdvice);
    return false;
  }

  private static collect(node: unknown, copies: Map<string, string>): void {
    const dependencies = CdkCopyCheck.field(node, Resources.npmListDependencies);
    if (typeof dependencies !== "object" || dependencies === null)
      return;
    for (const [name, child] of Object.entries(dependencies)) {
      const folder = CdkCopyCheck.field(child, Resources.npmListPath);
      if (name === Resources.cdkPackage && typeof folder === "string")
        copies.set(folder, String(CdkCopyCheck.field(child, Resources.npmListVersion)));
      CdkCopyCheck.collect(child, copies);
    }
  }

  private static field(value: unknown, name: string): unknown {
    return typeof value === "object" && value !== null && !Array.isArray(value) ? Object.fromEntries(Object.entries(value))[name] : undefined;
  }
}
