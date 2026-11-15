/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { DatabaseSync } from "node:sqlite";

import type { Migration } from "@noldova/desktop.runtime";
import { FakeModuleDatabase } from "@noldova/desktop.runtime/testing";

export class MemoryModuleDatabase extends FakeModuleDatabase implements Disposable {
  public readonly statements: string[] = [];
  private readonly connection: DatabaseSync = new DatabaseSync(":memory:");

  public constructor(migrations: readonly Migration[] = []) {
    super();
    for (const migration of migrations)
      for (const statement of migration.statements)
        this.connection.exec(statement);
    this.answer("read", (statement, ...values) => this.connection.prepare(statement).get(...values));
    this.answer("readAll", (statement, ...values) => this.connection.prepare(statement).all(...values));
    this.answer("run", (statement, ...values) => {
      this.statements.push(statement);
      return this.connection.prepare(statement).run(...values);
    });
    this.answer("transaction", <T>(action: () => T): T => {
      this.connection.exec("BEGIN");
      try {
        const result: T = action();
        this.connection.exec("COMMIT");
        return result;
      }
      catch (error: unknown) {
        this.connection.exec("ROLLBACK");
        throw error;
      }
    });
  }

  public [Symbol.dispose](): void {
    this.connection.close();
  }
}
