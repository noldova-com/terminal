/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonValue } from "@noldova/context.json";
import { describe, expect, it } from "vitest";

import { TerminalTabKey } from "../../../src/app/models/terminal-tab-key.ts";

describe("TerminalTabKey", () => {
  it("reads a view tab's view and instance from the tab menu's arguments, an instance that holds slashes included", () => {
    const keys: (TerminalTabKey | null)[] = ["view/terminal.session/s1", "view/terminal.session/a/b/c", "view/terminal.panel"]
      .map(t => TerminalTabKey.fromArguments({ tab: t, tabGroup: "g1" }));

    expect(keys.map(t => [t?.view, t?.instance])).toEqual([
      ["terminal.session", "s1"],
      ["terminal.session", "a/b/c"],
      ["terminal.panel", null]
    ]);
  });

  it("reads no view tab from a document's tab, a key it doesn't know, or arguments without a tab", () => {
    const values: readonly JsonValue[] = [
      { tab: "document/notes.note/3" },
      { tab: "view" },
      { tab: "view//s1" },
      { tab: "" },
      { tab: 3 },
      {},
      null,
      "view/terminal.panel",
      ["view/terminal.panel"]
    ];

    expect(values.map(t => TerminalTabKey.fromArguments(t))).toEqual(values.map(() => null));
  });
});
