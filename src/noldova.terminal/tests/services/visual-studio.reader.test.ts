/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { JsonException, JsonReader } from "@noldova/context.json";
import { ProcessExit } from "@noldova/desktop.runtime";
import { ArgumentValidator } from "@noldova/terminal.protocol";
import { describe, it, vi } from "vitest";

import { CommandExitedException } from "../../src/exceptions/command-exited.exception.ts";
import { CommandTimedOutException } from "../../src/exceptions/command-timed-out.exception.ts";
import { VisualStudioUnreadableException } from "../../src/exceptions/visual-studio-unreadable.exception.ts";
import type { VisualStudioInstallation } from "../../src/models/visual-studio-installation.ts";
import { VisualStudioReader } from "../../src/services/visual-studio.reader.ts";
import { FakeCommandRunner } from "../fixtures/fake-command-runner.fixture.ts";
import { FakeFileSystemReader } from "../fixtures/fake-file-system-reader.fixture.ts";

const VSWHERE: string = "C:\\Program Files (x86)\\Microsoft Visual Studio\\Installer\\vswhere.exe";
const UNREADABLE: string = "The shell list leaves out Visual Studio's developer shells, since its installations could not be read.";

function readAsync(output: string | Error | Promise<string>, runner: FakeCommandRunner = new FakeCommandRunner()): Promise<readonly VisualStudioInstallation[]> {
  const fileSystem: FakeFileSystemReader = new FakeFileSystemReader();
  fileSystem.files.set(VSWHERE, "");
  runner.answers.set(VSWHERE, output);
  return new VisualStudioReader(runner, fileSystem, "C:\\Program Files (x86)").readAsync();
}

describe("VisualStudioReader", () => {
  it("reads the installations vswhere reports", async () => {
    const runner: FakeCommandRunner = new FakeCommandRunner();
    const installations: readonly VisualStudioInstallation[] = await readAsync(JSON.stringify([
      { instanceId: "e7143cad", displayName: "Visual Studio Professional 2026", installationPath: "C:\\Program Files\\Microsoft Visual Studio\\18\\Professional",
        installationVersion: "18.10" },
      { instanceId: "1b2c", displayName: "Visual Studio Build Tools 2022 — Café", installationPath: "D:\\Tools" }
    ]), runner);

    assert.deepEqual(installations.map(t => [t.instanceId, t.name, t.path]), [
      ["e7143cad", "Visual Studio Professional 2026", "C:\\Program Files\\Microsoft Visual Studio\\18\\Professional"],
      ["1b2c", "Visual Studio Build Tools 2022 — Café", "D:\\Tools"]
    ]);
    assert.deepEqual(runner.runs, [[VSWHERE, ["-products", "*", "-prerelease", "-utf8", "-format", "json"], 60_000]]);
  });

  it("leaves out an installation whose id, name or path is longer than the protocol takes, and reads the others", async () => {
    const installations: readonly VisualStudioInstallation[] = await readAsync(JSON.stringify([
      { instanceId: "a".repeat(201), displayName: "Long id", installationPath: "C:\\VS1" },
      { instanceId: "b2", displayName: "N".repeat(201), installationPath: "C:\\VS2" },
      { instanceId: "c3", displayName: "Long path", installationPath: `C:\\${"p".repeat(4_094)}` },
      { instanceId: "d4", displayName: "Visual Studio Community 2026", installationPath: "C:\\VS4" }
    ]));

    assert.deepEqual(installations.map(t => t.instanceId), ["d4"]);
  });

  it("reads nothing without vswhere, running nothing", async () => {
    const runner: FakeCommandRunner = new FakeCommandRunner();
    const fileSystem: FakeFileSystemReader = new FakeFileSystemReader();

    assert.deepEqual(await new VisualStudioReader(runner, fileSystem, "C:\\Program Files (x86)").readAsync(), []);
    assert.deepEqual(await new VisualStudioReader(runner, fileSystem, undefined).readAsync(), []);
    assert.deepEqual(await new VisualStudioReader(runner, fileSystem, "").readAsync(), []);
    assert.deepEqual(runner.runs, []);
  });

  it("refuses output it can't read", async () => {
    const valid: Readonly<Record<string, string>> = { instanceId: "a", displayName: "b", installationPath: "c" };
    const outputs: readonly string[] = ["not json", "{}", "[1]", "[null]", "[[]]", JSON.stringify([{ ...valid, instanceId: 3 }]), JSON.stringify([{ ...valid, displayName: " " }]),
      JSON.stringify([{ instanceId: "a", displayName: "b" }]), JSON.stringify([{ displayName: "b", installationPath: "c" }]),
      JSON.stringify([{ instanceId: "a", installationPath: "c" }])];

    for (const output of outputs)
      await assert.rejects(readAsync(output), new VisualStudioUnreadableException());
  });

  it("keeps why the output could not be read as the cause", async () => {
    await assert.rejects(readAsync("not json"), (error: unknown) => error instanceof VisualStudioUnreadableException && error.cause instanceof SyntaxError);
    await assert.rejects(readAsync("[1]"), (error: unknown) => error instanceof VisualStudioUnreadableException && error.cause instanceof JsonException);
    await assert.rejects(readAsync("{}"), (error: unknown) => error instanceof VisualStudioUnreadableException && error.cause === undefined);
  });

  it("reports vswhere's failure, keeping it as the cause", async () => {
    const exited: CommandExitedException = new CommandExitedException("vswhere.exe", new ProcessExit(4, null));

    for (const failure of [exited, new CommandTimedOutException("vswhere.exe", 60_000)])
      await assert.rejects(readAsync(failure), (error: unknown) => {
        assert.ok(error instanceof VisualStudioUnreadableException);
        assert.deepEqual([error.message, error.cause], [UNREADABLE, failure]);
        return true;
      });
  });

  it("passes on a failure of the run that isn't vswhere's", async () => {
    const failure: TypeError = new TypeError("broken");

    await assert.rejects(readAsync(failure), failure);
  });

  it("passes on a failure that is neither the JSON's nor an argument's", async () => {
    const failure: TypeError = new TypeError("broken");
    const output: string = JSON.stringify([{ instanceId: "a", displayName: "b", installationPath: "c" }]);
    const reading = vi.spyOn(JsonReader, "fromValue").mockImplementation(() => {
      throw failure;
    });
    try {
      await assert.rejects(readAsync(output), failure);
    }
    finally {
      reading.mockRestore();
    }
    const validating = vi.spyOn(ArgumentValidator, "requireIdentifier").mockImplementation(() => {
      throw failure;
    });
    try {
      await assert.rejects(readAsync(output), failure);
    }
    finally {
      validating.mockRestore();
    }
    const parsing = vi.spyOn(JSON, "parse").mockImplementationOnce(() => {
      throw failure;
    });
    try {
      await assert.rejects(readAsync(output), failure);
    }
    finally {
      parsing.mockRestore();
    }
  });
});
