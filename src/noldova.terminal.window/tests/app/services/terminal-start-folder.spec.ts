/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { afterEach, describe, expect, it } from "vitest";

import { StartFolderProvidedException } from "../../../src/app/exceptions/start-folder-provided.exception.ts";
import { TerminalStartFolder } from "../../../src/app/services/terminal-start-folder.ts";
import { TerminalPartContext } from "../../fixtures/terminal-part-context.fixture.ts";

describe("TerminalStartFolder", () => {
  const unregisters: (() => void)[] = [];

  afterEach(() => {
    for (const unregister of unregisters.splice(0))
      unregister();
  });

  it("gives the home folder until an app provides one", () => {
    expect(TerminalStartFolder.read()).toBeNull();
  });

  it("asks the provider at each read", () => {
    let folder: string | null = "/work/one";
    unregisters.push(TerminalStartFolder.provide(new TerminalPartContext(), () => folder));

    const first: string | null = TerminalStartFolder.read();
    folder = "C:\\work\\two";

    expect([first, TerminalStartFolder.read()]).toEqual(["/work/one", "C:\\work\\two"]);
  });

  it("gives the home folder when the provider gives none", () => {
    const context: TerminalPartContext = new TerminalPartContext();
    unregisters.push(TerminalStartFolder.provide(context, () => null));

    expect([TerminalStartFolder.read(), context.logs]).toEqual([null, []]);
  });

  it("gives the home folder for a blank, relative or over-long folder, and says so in the providing app's log", () => {
    const context: TerminalPartContext = new TerminalPartContext();
    let folder: string = " ";
    unregisters.push(TerminalStartFolder.provide(context, () => folder));

    const read: (string | null)[] = [];
    for (const next of [" ", "work/project", "C:work", `/${"a".repeat(4_096)}`]) {
      folder = next;
      read.push(TerminalStartFolder.read());
    }

    expect(read).toEqual([null, null, null, null]);
    expect(context.logs).toEqual([
      "The terminal opened in the home folder instead of the app's start folder: ArgumentException: The value must not be blank. (Parameter 'startFolder')",
      "The terminal opened in the home folder instead of the app's start folder: ArgumentException: The value must be an absolute path. (Parameter 'startFolder')",
      "The terminal opened in the home folder instead of the app's start folder: ArgumentException: The value must be an absolute path. (Parameter 'startFolder')",
      "The terminal opened in the home folder instead of the app's start folder: ArgumentException: The value must have at most 4096 characters. (Parameter 'startFolder')"
    ]);
  });

  it("gives the home folder when the provider throws, and says so in the providing app's log", () => {
    const context: TerminalPartContext = new TerminalPartContext();
    unregisters.push(TerminalStartFolder.provide(context, () => {
      throw new Error("No project is open.");
    }));

    expect([TerminalStartFolder.read(), context.logs]).toEqual([null, ["The terminal opened in the home folder instead of the app's start folder: Error: No project is open."]]);
  });

  it("refuses a second provider until the first is removed, and a removed provider's removal leaves the next in place", () => {
    const unregister: () => void = TerminalStartFolder.provide(new TerminalPartContext(), () => "/first");

    expect(() => TerminalStartFolder.provide(new TerminalPartContext(), () => "/second")).toThrow(StartFolderProvidedException);
    unregister();
    unregisters.push(TerminalStartFolder.provide(new TerminalPartContext(), () => "/second"));
    unregister();

    expect(TerminalStartFolder.read()).toBe("/second");
  });
});
