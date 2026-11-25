/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";

import type { Migration } from "@noldova/desktop.runtime";
import { FakeModuleDatabase, FakeModuleLog } from "@noldova/desktop.runtime/testing";
import { describe, it } from "vitest";

import { SavedTerminal } from "../../src/models/saved-terminal.ts";
import { SavedTerminals } from "../../src/services/saved-terminals.ts";

function databaseOf(migrations: readonly Migration[]): FakeModuleDatabase {
  const connection: DatabaseSync = new DatabaseSync(":memory:");
  for (const statement of migrations.flatMap(t => t.statements))
    connection.exec(statement);
  const database: FakeModuleDatabase = new FakeModuleDatabase();
  database.answer("readAll", (statement, ...values) => connection.prepare(statement).all(...values));
  database.answer("run", (statement, ...values) => connection.prepare(statement).run(...values));
  return database;
}

describe("SavedTerminals", () => {
  it("lists the terminals it keeps in the order they were first kept, each in its last folder", () => {
    const saved: SavedTerminals = new SavedTerminals(databaseOf(SavedTerminals.migrations), new FakeModuleLog());
    saved.save(new SavedTerminal("s1", "bash", "/work", false));
    saved.save(new SavedTerminal("s2", "zsh", "/home/a", true));
    saved.save(new SavedTerminal("s3", "bash", "/tmp", false));

    saved.save(new SavedTerminal("s1", "pwsh", "/other", true));
    saved.moveTo("s2", "/home/a/src");
    saved.moveTo("gone", "/nowhere");
    saved.forget("s3");
    saved.forget("gone");

    assert.deepEqual(saved.list(), [new SavedTerminal("s1", "pwsh", "/other", true), new SavedTerminal("s2", "zsh", "/home/a/src", true)]);
  });

  it("keeps each terminal's owner, and forgets every terminal of an owner", () => {
    const saved: SavedTerminals = new SavedTerminals(databaseOf(SavedTerminals.migrations), new FakeModuleLog());
    saved.save(new SavedTerminal("s1", "bash", "/work", false, "example.chat/42"));
    saved.save(new SavedTerminal("s2", "bash", "/work", false));
    saved.save(new SavedTerminal("s3", "bash", "/work", false, "example.chat/7"));
    saved.save(new SavedTerminal("s4", "bash", "/work", false, "example.chat/42"));
    saved.save(new SavedTerminal("s3", "bash", "/work", false, "example.chat/42"));

    assert.deepEqual(saved.list().map(t => t.owner), ["example.chat/42", null, "example.chat/42", "example.chat/42"]);
    saved.forgetOwner("example.chat/42");
    saved.forgetOwner("example.chat/9");

    assert.deepEqual(saved.list(), [new SavedTerminal("s2", "bash", "/work", false)]);
  });

  it("gives the terminals an earlier version kept no owner, a tab and no name", () => {
    const [create, ...later] = SavedTerminals.migrations;
    assert.ok(!Object.isUndefined(create));
    const database: FakeModuleDatabase = databaseOf([create]);
    database.run("INSERT INTO terminals (session_id, shell_id, folder, is_panel_terminal, position) VALUES ('s1', 'bash', '/work', 0, 1)");

    for (const statement of later.flatMap(t => t.statements))
      database.run(statement);

    assert.deepEqual(SavedTerminals.migrations.map(t => t.id), ["create-terminals", "add-terminal-owner", "add-terminal-opens-tab", "add-terminal-name"]);
    assert.deepEqual(new SavedTerminals(database, new FakeModuleLog()).list(), [new SavedTerminal("s1", "bash", "/work", false, null, true, null)]);
  });

  it("keeps each terminal's name through a later save, takes it away, and names no terminal it doesn't keep", () => {
    const saved: SavedTerminals = new SavedTerminals(databaseOf(SavedTerminals.migrations), new FakeModuleLog());
    saved.save(new SavedTerminal("s1", "bash", "/work", false));
    saved.save(new SavedTerminal("s2", "bash", "/work", false));
    saved.rename("s1", "Server");
    saved.rename("s2", "Build");
    saved.rename("gone", "Logs");

    saved.save(new SavedTerminal("s1", "pwsh", "/other", false));
    saved.rename("s2", null);

    assert.deepEqual(saved.list().map(t => [t.sessionId, t.name]), [["s1", "Server"], ["s2", null]]);
  });

  it("keeps whether a window opens each terminal's tab", () => {
    const saved: SavedTerminals = new SavedTerminals(databaseOf(SavedTerminals.migrations), new FakeModuleLog());
    saved.save(new SavedTerminal("s1", "bash", "/work", false, "example.chat/42", false));
    saved.save(new SavedTerminal("s2", "bash", "/work", false, "example.chat/42"));
    saved.save(new SavedTerminal("s2", "bash", "/work", false, "example.chat/42", false));

    assert.deepEqual(saved.list().map(t => [t.sessionId, t.opensTab]), [["s1", false], ["s2", false]]);
  });

  it("puts a terminal kept after another was forgotten last", () => {
    const saved: SavedTerminals = new SavedTerminals(databaseOf(SavedTerminals.migrations), new FakeModuleLog());
    saved.save(new SavedTerminal("s1", "bash", "/work", false));
    saved.save(new SavedTerminal("s2", "bash", "/work", false));
    saved.forget("s2");

    saved.save(new SavedTerminal("s3", "bash", "/work", false));

    assert.deepEqual(saved.list().map(t => t.sessionId), ["s1", "s3"]);
  });

  it("logs each write it can't make instead of throwing it", () => {
    const database: FakeModuleDatabase = databaseOf(SavedTerminals.migrations);
    const log: FakeModuleLog = new FakeModuleLog();
    const saved: SavedTerminals = new SavedTerminals(database, log);
    database.run("DROP TABLE terminals");

    saved.save(new SavedTerminal("s1", "bash", "/work", false));
    saved.moveTo("s1", "/work/src");
    saved.rename("s1", "Server");
    saved.forget("s1");
    saved.forgetOwner("example.chat/42");

    assert.deepEqual(log.callsOf("write").map(t => t[0]), [
      "Terminal s1 could not be kept for the next run: no such table: terminals",
      "Terminal s1 could not be kept for the next run: no such table: terminals",
      "Terminal s1 could not be kept for the next run: no such table: terminals",
      "Terminal s1 could not be kept for the next run: no such table: terminals",
      "The terminals of example.chat/42 could not be forgotten for the next run: no such table: terminals"
    ]);
    assert.throws(() => saved.list(), /no such table: terminals/u);
  });

  it("logs what the database threw when it isn't an error", () => {
    const database: FakeModuleDatabase = databaseOf(SavedTerminals.migrations);
    const log: FakeModuleLog = new FakeModuleLog();
    database.answer("run", () => {
      throw "The database is locked.";
    });

    new SavedTerminals(database, log).forget("s1");

    assert.deepEqual(log.callsOf("write").map(t => t[0]), ["Terminal s1 could not be kept for the next run: The database is locked."]);
  });
});
