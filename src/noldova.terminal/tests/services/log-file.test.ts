/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { FakeModuleLog } from "@noldova/desktop.runtime/testing";
import { describe, it } from "vitest";

import { LogFile } from "../../src/services/log-file.ts";
import { FakeFileSystemWriter } from "../fixtures/fake-file-system-writer.fixture.ts";

const LIMIT: number = 16_777_216;

class HeldWriter extends FakeFileSystemWriter {
  public readonly appends: string[] = [];
  private readonly held: PromiseWithResolvers<void> = Promise.withResolvers<void>();

  public override async appendTextAsync(path: string, text: string): Promise<void> {
    this.appends.push(text);
    await this.held.promise;
    await super.appendTextAsync(path, text);
  }

  public release(): void {
    this.held.resolve();
  }
}

describe("LogFile", () => {
  it("appends text in order", async () => {
    const writer: FakeFileSystemWriter = new FakeFileSystemWriter();
    const file: LogFile = new LogFile(writer, "/logs/t1.log", new FakeModuleLog());

    file.append("one ");
    file.append("two");
    await file.flushAsync();

    assert.equal(file.path, "/logs/t1.log");
    assert.equal(writer.files.get("/logs/t1.log"), "one two");
  });

  it("joins the text that comes while a write is under way into one next write", async () => {
    const writer: HeldWriter = new HeldWriter();
    const file: LogFile = new LogFile(writer, "/logs/t1.log", new FakeModuleLog());

    file.append("one ");
    file.append("two ");
    file.append("three");
    assert.deepEqual(writer.appends, ["one "]);
    writer.release();
    await file.flushAsync();

    assert.deepEqual([writer.appends, writer.files.get("/logs/t1.log")], [["one ", "two three"], "one two three"]);
  });

  it("keeps the text up to its limit, ends the file with a line saying it stops there, logs once that it is full, and takes no more", async () => {
    const writer: FakeFileSystemWriter = new FakeFileSystemWriter();
    const log: FakeModuleLog = new FakeModuleLog();
    const file: LogFile = new LogFile(writer, "/logs/t1.log", log);

    file.append("a".repeat(LIMIT - 1));
    assert.deepEqual(log.callsOf("write"), []);
    file.append("bc");
    file.append("d");
    await file.flushAsync();

    assert.equal(writer.files.get("/logs/t1.log"), `${"a".repeat(LIMIT - 1)}b\n[… the log stops here: it reached its limit of 16777216 characters …]\n`);
    assert.deepEqual(log.callsOf("write"), [[`The log file /logs/t1.log reached its limit of ${LIMIT} characters and takes no more output.`]]);
  });

  it("logs the first failed write once, with its cause, and takes no more", async () => {
    const failures: readonly [Error | string, string][] = [
      [new Error("disk full", { cause: new Error("ENOSPC") }), "disk full ENOSPC"],
      ["no access", "no access"]
    ];
    for (const [failure, reason] of failures) {
      const writer: FakeFileSystemWriter = new FakeFileSystemWriter();
      const log: FakeModuleLog = new FakeModuleLog();
      const file: LogFile = new LogFile(writer, "/logs/t1.log", log);
      writer.failure = failure;

      file.append("one");
      file.append("two");
      await file.flushAsync();
      writer.failure = null;
      file.append("three");
      await file.flushAsync();

      assert.equal(writer.files.has("/logs/t1.log"), false);
      assert.deepEqual(log.callsOf("write"), [[`The log file /logs/t1.log stopped taking output: ${reason}`]]);
    }
  });
});
