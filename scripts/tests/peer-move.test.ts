/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import type { IModulePackage } from "../interfaces/i-module-package.ts";
import { ModulePackage } from "../models/module-package.ts";
import { ProcessResult } from "../models/process-result.ts";
import { NpmCommand } from "../services/npm-command.ts";
import { PackageLayout } from "../services/package-layout.ts";
import { PeerMove } from "../services/peer-move.ts";
import { ProcessRunner } from "../services/process-runner.ts";

const PART = "src/noldova.terminal.runtime";

class JsonFile {
  public static async writeAsync(file: string, json: object): Promise<void> {
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, JSON.stringify(json));
  }
}

class RegistryNpm extends NpmCommand {
  public readonly installs: (readonly string[])[] = [];
  private readonly published: ReadonlyMap<string, readonly string[]>;
  private readonly root: string;

  public constructor(root: string, published: ReadonlyMap<string, readonly string[]>) {
    super(new ProcessRunner(), {});
    this.root = root;
    this.published = published;
  }

  public override async runAsync(npmArguments: readonly string[]): Promise<ProcessResult> {
    const [command, name] = npmArguments;
    if (command === "view")
      return new ProcessResult(0, JSON.stringify(this.published.get(name ?? "") ?? []), "");
    const specs = npmArguments.filter(t => t.startsWith("@noldova/"));
    this.installs.push(specs);
    for (const spec of specs) {
      const at = spec.lastIndexOf("@");
      await JsonFile.writeAsync(path.join(this.root, "node_modules", ...spec.slice(0, at).split("/"), "package.json"), { version: spec.slice(at + 1) });
    }
    return new ProcessResult(0, "", "");
  }
}

class OnePartLayout extends PackageLayout {
  public override readPackagesAsync(): Promise<readonly IModulePackage[]> {
    return Promise.resolve([new ModulePackage(PART, "@noldova/terminal.runtime")]);
  }
}

class PeerMoveRun {
  public readonly exitCode: number;
  public readonly lines: readonly string[];
  public readonly npm: RegistryNpm;

  public constructor(exitCode: number, lines: readonly string[], npm: RegistryNpm) {
    this.exitCode = exitCode;
    this.lines = lines;
    this.npm = npm;
  }
}

class PeerMoveFixture {
  private readonly roots: string[] = [];

  public async makeRootAsync(peers: Readonly<Record<string, string>>): Promise<string> {
    const root = await mkdtemp(path.join(os.tmpdir(), "noldova-peer-move-"));
    this.roots.push(root);
    await JsonFile.writeAsync(path.join(root, "package.json"), {
      version: "0.0.3",
      devDependencies: { "@noldova/context.exceptions": "0.0.13", "@noldova/context.text": "0.0.13", "@noldova/desktop.runtime": "0.0.17" }
    });
    await JsonFile.writeAsync(path.join(root, PART, "package.json"), { peerDependencies: peers });
    for (const [name, version] of Object.entries({ "context.exceptions": "0.0.13", "context.text": "0.0.13", "desktop.runtime": "0.0.17" }))
      await JsonFile.writeAsync(path.join(root, "node_modules", "@noldova", name, "package.json"), { version });
    return root;
  }

  public async moveAsync(root: string, published: ReadonlyMap<string, readonly string[]>): Promise<PeerMoveRun> {
    const npm = new RegistryNpm(root, published);
    const lines: string[] = [];
    const report = (line: string): void => {
      lines.push(line);
    };
    const exitCode = await new PeerMove(root, new OnePartLayout(root), npm, report).runAsync();
    return new PeerMoveRun(exitCode, lines, npm);
  }

  public async cleanAsync(): Promise<void> {
    await Promise.all(this.roots.splice(0).map(t => rm(t, { recursive: true, force: true })));
  }
}

describe("PeerMove", () => {
  const fixture = new PeerMoveFixture();

  afterEach(async () => {
    await fixture.cleanAsync();
  });

  it("moves every context pin to the newest version all of them have published, while a release has reached only some", async () => {
    const root = await fixture.makeRootAsync({ "@noldova/context.exceptions": ">=0.0.13 <0.1.0" });

    const { exitCode, lines, npm } = await fixture.moveAsync(root, new Map([
      ["@noldova/context.exceptions", ["0.0.12", "0.0.13", "0.0.14"]],
      ["@noldova/context.text", ["0.0.12", "0.0.13"]]
    ]));

    expect(exitCode).toBe(0);
    expect(npm.installs).toEqual([["@noldova/context.exceptions@0.0.13", "@noldova/context.text@0.0.13", "@noldova/desktop.runtime@0.0.17"]]);
    expect(lines).toEqual([
      "Moved @noldova/context.exceptions to 0.0.13, the newest published version inside the packages' peer ranges.",
      "Moved @noldova/context.text to 0.0.13, the newest published version inside the packages' peer ranges."
    ]);
  });

  it("moves to the newer version once every context package has published it", async () => {
    const root = await fixture.makeRootAsync({ "@noldova/context.exceptions": ">=0.0.13 <0.1.0" });

    const { exitCode, npm } = await fixture.moveAsync(root, new Map([
      ["@noldova/context.exceptions", ["0.0.13", "0.0.14"]],
      ["@noldova/context.text", ["0.0.13", "0.0.14"]]
    ]));

    expect(exitCode).toBe(0);
    expect(npm.installs).toEqual([["@noldova/context.exceptions@0.0.14", "@noldova/context.text@0.0.14", "@noldova/desktop.runtime@0.0.17"]]);
  });

  it("moves a peer outside context to its own newest version, apart from the context packages' shared one", async () => {
    const root = await fixture.makeRootAsync({ "@noldova/context.exceptions": ">=0.0.13 <0.1.0", "@noldova/ui.components.angular": ">=0.0.34 <0.1.0" });

    const { exitCode, npm } = await fixture.moveAsync(root, new Map([
      ["@noldova/context.exceptions", ["0.0.13", "0.0.14"]],
      ["@noldova/context.text", ["0.0.13"]],
      ["@noldova/ui.components.angular", ["0.0.34", "0.0.35"]]
    ]));

    expect(exitCode).toBe(0);
    expect(npm.installs).toEqual([["@noldova/ui.components.angular@0.0.35", "@noldova/context.exceptions@0.0.13", "@noldova/context.text@0.0.13", "@noldova/desktop.runtime@0.0.17"]]);
  });

  it("installs nothing and names the packages when no version is published by all of them inside the ranges", async () => {
    const root = await fixture.makeRootAsync({ "@noldova/context.exceptions": ">=0.0.14 <0.1.0" });

    const { exitCode, lines, npm } = await fixture.moveAsync(root, new Map([
      ["@noldova/context.exceptions", ["0.0.13", "0.0.14"]],
      ["@noldova/context.text", ["0.0.13"]]
    ]));

    expect(exitCode).toBe(1);
    expect(npm.installs).toEqual([]);
    expect(lines).toEqual(["npm view gives no version that @noldova/context.exceptions, @noldova/context.text have all published inside the packages' peer ranges."]);
  });

  it("installs nothing and names the range when a package has published no version inside it", async () => {
    const root = await fixture.makeRootAsync({ "@noldova/context.exceptions": ">=0.0.15 <0.1.0" });

    const { exitCode, lines, npm } = await fixture.moveAsync(root, new Map([
      ["@noldova/context.exceptions", ["0.0.13", "0.0.14"]],
      ["@noldova/context.text", ["0.0.13", "0.0.14"]]
    ]));

    expect(exitCode).toBe(1);
    expect(npm.installs).toEqual([]);
    expect(lines).toEqual(["npm view gives no published version of @noldova/context.exceptions inside >=0.0.15 <0.1.0."]);
  });

  it("moves nothing when no part takes a context peer", async () => {
    const root = await fixture.makeRootAsync({});

    const { exitCode, lines, npm } = await fixture.moveAsync(root, new Map());

    expect(exitCode).toBe(0);
    expect(npm.installs).toEqual([]);
    expect(lines).toEqual([]);
  });
});
