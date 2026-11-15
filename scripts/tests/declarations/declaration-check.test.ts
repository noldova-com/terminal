/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { spawnSync, type SpawnSyncReturns } from "node:child_process";
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { Resources } from "../../resources.ts";

const repository: string = path.join(import.meta.dirname, "..", "..", "..");
const check: string = path.join(repository, "scripts", "declarations", "declaration-check.ts");
const folders: string[] = [];

async function copyRepositoryAsync(): Promise<string> {
  const root: string = await mkdtemp(path.join(tmpdir(), "noldova-declaration-check-"));
  folders.push(root);
  for (const file of [Resources.manifestFile, `${Resources.moduleFolder}/${Resources.moduleFile}`, `${Resources.moduleFolder}/${Resources.manifestFile}`, `${Resources.windowFolder}/${Resources.manifestFile}`]) {
    await mkdir(path.dirname(path.join(root, file)), { recursive: true });
    await copyFile(path.join(repository, file), path.join(root, file));
  }
  await mkdir(path.join(root, Resources.moduleFolder, Resources.sourceFolder));
  return root;
}

async function pinAsync(root: string, folder: string, field: string, name: string, version: string): Promise<void> {
  const file: string = path.join(root, folder, Resources.manifestFile);
  const manifest: { [key: string]: { [name: string]: string } } = JSON.parse(await readFile(file, Resources.textEncoding));
  manifest[field] = { ...manifest[field], [name]: version };
  await writeFile(file, JSON.stringify(manifest), Resources.textEncoding);
}

function runCheck(root: string): { readonly status: number | null; readonly problems: readonly string[] } {
  const result: SpawnSyncReturns<string> = spawnSync(process.execPath, [check], { cwd: root, encoding: Resources.textEncoding });
  return { status: result.status, problems: result.stderr.split(/\r?\n/).filter(t => t.length > 0) };
}

afterEach(async () => {
  for (const folder of folders.splice(0))
    await rm(folder, { recursive: true, force: true });
});

describe("the declaration check", () => {
  it.each([
    [Resources.windowFolder, Resources.devDependenciesField, "@noldova/context.json", Resources.windowPackageManifest],
    [Resources.moduleFolder, Resources.dependenciesField, "@noldova/desktop.protocol", Resources.packageManifest]
  ])("refuses a part's manifest in %s that pins its own copy of a @noldova package in %s", async (folder, field, name, description) => {
    const root: string = await copyRepositoryAsync();
    await pinAsync(root, folder, field, name, "0.0.7");

    expect(runCheck(root)).toEqual({ status: 1, problems: [Resources.formatPartNoldovaPinned(description, name, field)] });
  });
});
