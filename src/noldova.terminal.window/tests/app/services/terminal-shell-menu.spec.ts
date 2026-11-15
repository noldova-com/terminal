/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TerminalNames, TerminalShell, TerminalShellKind } from "@noldova/terminal.protocol";
import { describe, expect, it } from "vitest";

import { TerminalShellMenu } from "../../../src/app/services/terminal-shell-menu.ts";
import { FakeRuntime } from "../../fixtures/fake-runtime.fixture.ts";

describe("TerminalShellMenu", () => {
  it("offers no shell rows, and leaves Settings waiting, until the shells are listed", () => {
    const menu: TerminalShellMenu = new TerminalShellMenu(new FakeRuntime().context);

    expect([menu.listRows(), menu.listOptions()]).toEqual([[], null]);
  });

  it("offers a row that opens each shell, with its kind's icon, marking the runtime's default while no Default shell is set, whose row is New Terminal's own", async () => {
    const runtime: FakeRuntime = new FakeRuntime();
    const menu: TerminalShellMenu = new TerminalShellMenu(runtime.context);

    await menu.loadAsync();

    expect(menu.listRows().map(t => [t.command, t.commandArguments, t.label, t.icon])).toEqual([
      ["terminal.new", {}, "Bash (default)", "attach_money"],
      ["terminal.newWithShell", { shellId: "zsh" }, "Zsh", "percent"]
    ]);
    expect(runtime.context.sent(TerminalNames.shellsMethod)).toEqual([null]);
  });

  it("marks the Default shell setting's shell while the runtime finds it, and the runtime's default once it doesn't", async () => {
    const runtime: FakeRuntime = new FakeRuntime();
    const menu: TerminalShellMenu = new TerminalShellMenu(runtime.context);
    await menu.loadAsync();

    runtime.context.settings.set("terminal.defaultShell", "zsh");
    const chosen: (string | null)[][] = menu.listRows().map(t => [t.command, t.label]);
    runtime.context.settings.set("terminal.defaultShell", "fish");

    expect([chosen, menu.listRows().map(t => [t.command, t.label])]).toEqual([
      [["terminal.newWithShell", "Bash"], ["terminal.new", "Zsh (default)"]],
      [["terminal.new", "Bash (default)"], ["terminal.newWithShell", "Zsh"]]
    ]);
  });

  it("offers the runtime's default, by name, and every shell as the Default shell options, and asks Settings again once they are listed", async () => {
    const runtime: FakeRuntime = new FakeRuntime();
    const menu: TerminalShellMenu = new TerminalShellMenu(runtime.context);

    await menu.loadAsync();

    expect(menu.listOptions()?.map(t => [t.value, t.title])).toEqual([["", "System default (Bash)"], ["bash", "Bash"], ["zsh", "Zsh"]]);
    expect(runtime.context.refreshedSettings).toEqual(["terminal.defaultShell"]);
  });

  it("names no shell for the system default when the runtime marks none as its default", async () => {
    const runtime: FakeRuntime = new FakeRuntime();
    runtime.shells.splice(0, runtime.shells.length, new TerminalShell("zsh", "Zsh", TerminalShellKind.Zsh, false));
    const menu: TerminalShellMenu = new TerminalShellMenu(runtime.context);

    await menu.loadAsync();

    expect(menu.listOptions()?.map(t => [t.value, t.title])).toEqual([["", "System default"], ["zsh", "Zsh"]]);
    expect(menu.listRows().map(t => [t.command, t.label])).toEqual([["terminal.newWithShell", "Zsh"]]);
  });

  it("logs shells it could not list, offers no rows and only the system default, and stops Settings waiting", async () => {
    for (const failure of [new Error("The runtime is gone."), "The runtime is gone."]) {
      const runtime: FakeRuntime = new FakeRuntime();
      runtime.shellsFailure = failure;
      const menu: TerminalShellMenu = new TerminalShellMenu(runtime.context);

      await menu.loadAsync();

      expect(runtime.context.logs).toEqual(["The shells could not be listed, so the shell menu and the Default shell setting offer none: The runtime is gone."]);
      expect([menu.listRows(), menu.listOptions()?.map(t => [t.value, t.title])]).toEqual([[], [["", "System default"]]]);
      expect(runtime.context.refreshedSettings).toEqual(["terminal.defaultShell"]);
    }
  });
});
