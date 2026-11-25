/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import { TestBed } from "@angular/core/testing";
import { TerminalInputEdge, TerminalInputMark, TerminalMissingCommands, TerminalNames, TerminalResizeParams, TerminalShellKind, type TerminalSize } from "@noldova/terminal.protocol";
import { AppearanceService, ModePreference, Typography } from "@noldova/ui.components.angular";
import { AppearanceFixture, KitStylesheetFixture } from "@noldova/ui.components.angular/testing";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cdp } from "vitest/browser";

import { TerminalPanelComponent } from "../../../../src/app/components/terminal-panel/terminal-panel.component.ts";
import { Resources } from "../../../../src/resources.ts";
import { DrawnWait } from "../../../../tests/fixtures/drawn-wait.fixture.ts";
import { FakeRuntime } from "../../../../tests/fixtures/fake-runtime.fixture.ts";
import { PaneHost } from "../../../../tests/fixtures/pane-host.fixture.ts";
import { ScreenShot } from "../../../../tests/fixtures/screen-shot.fixture.ts";

const INK_MISS: number = 24;
const INK_SHARE: number = 0.5;
const INK_OVERSHOOT: number = 1.1;

describe("TerminalPaneComponent's colors for a typed command", () => {
  const screenshots: string = "../../../../../../_build/window/screenshots";
  const modes: readonly ModePreference[] = [ModePreference.Light, ModePreference.Dark];
  let host: PaneHost<TerminalPanelComponent> | null = null;

  afterEach(async () => {
    await cdp().send("Emulation.setEmulatedMedia", { features: [] });
    host?.fixture.destroy();
    host = null;
    AppearanceFixture.reset();
  });

  const paneOf = (shown: PaneHost<TerminalPanelComponent>): HTMLElement => shown.element.querySelector<HTMLElement>("nol-terminal-pane") ?? shown.element;
  const sizeOf = (shown: PaneHost<TerminalPanelComponent>): TerminalSize =>
    TerminalResizeParams.fromJson(shown.runtime.context.sent(TerminalNames.resizeMethod).at(-1) ?? null).size;
  const rgbOf = (color: string): string => {
    const probe: HTMLElement = document.createElement("span");
    probe.style.forcedColorAdjust = "none";
    probe.style.color = color;
    document.body.append(probe);
    const value: string = getComputedStyle(probe).color;
    probe.remove();
    return value;
  };
  const plainOf = (): string => rgbOf("var(--nol-terminal-foreground)");
  const channelsOf = (color: string): readonly number[] => (color.match(/\d+/gu) ?? []).map(Number);
  const inkOf = (pixels: readonly string[], colors: readonly string[]): string | undefined => {
    const counts: Map<string, number> = new Map<string, number>();
    for (const pixel of pixels)
      counts.set(pixel, (counts.get(pixel) ?? 0) + 1);
    let background: readonly number[] = [];
    let most: number = 0;
    for (const [pixel, count] of counts) {
      if (count > most) {
        most = count;
        background = channelsOf(pixel);
      }
    }
    let found: string | undefined = undefined;
    let bestScore: number = 0;
    for (const color of colors) {
      const toward: readonly number[] = channelsOf(color).map((t, index) => t - (background[index] ?? 0));
      const length: number = toward.reduce((sum, t) => sum + t * t, 0);
      for (const pixel of length === 0 ? [] : pixels) {
        const offset: readonly number[] = channelsOf(pixel).map((t, index) => t - (background[index] ?? 0));
        const share: number = offset.reduce((sum, t, index) => sum + t * (toward[index] ?? 0), 0) / length;
        const miss: number = Math.hypot(...offset.map((t, index) => t - share * (toward[index] ?? 0)));
        const score: number = Math.min(share, 1) * (1 - miss / INK_MISS);
        if (share >= INK_SHARE && share <= INK_OVERSHOOT && miss <= INK_MISS && score > bestScore) {
          bestScore = score;
          found = color;
        }
      }
    }
    return found;
  };
  const drawnAsync = async (shown: PaneHost<TerminalPanelComponent>, colors: readonly string[], count: number, name: string): Promise<(string | undefined)[]> => {
    const size: TerminalSize = sizeOf(shown);
    const screen: DOMRect = shown.screen.getBoundingClientRect();
    const cellWidth: number = screen.width / size.columns;
    const cellHeight: number = screen.height / size.rows;
    const shot: ScreenShot = await ScreenShot.takeAsync(shown.element, `${screenshots}/${name}.png`);
    return Array.from({ length: count }, (_, column) => inkOf(shot.inside(screen.left + cellWidth * column, screen.top, cellWidth, cellHeight), colors));
  };
  const tokenOf = (shown: PaneHost<TerminalPanelComponent>, token: string): string => rgbOf(getComputedStyle(paneOf(shown)).getPropertyValue(token).trim());

  const openAsync = async (mode: ModePreference, setting: boolean | null, shellKind: TerminalShellKind = TerminalShellKind.Bash,
    prepare: (runtime: FakeRuntime) => void = () => undefined): Promise<PaneHost<TerminalPanelComponent>> => {
    await KitStylesheetFixture.ensureAsync();
    const runtime: FakeRuntime = new FakeRuntime();
    runtime.context.settings.set(Resources.fontSizeSetting, 24);
    if (!Object.isNull(setting))
      runtime.context.settings.set(Resources.commandColorsSetting, setting);
    prepare(runtime);
    runtime.shellKind = shellKind;
    const shown: PaneHost<TerminalPanelComponent> = new PaneHost(TerminalPanelComponent, true, {}, runtime);
    host = shown;
    shown.runtime.addSession("mine", "bash", "/work", null, false, true);
    const appearance: AppearanceService = TestBed.inject(AppearanceService);
    appearance.setModePreference(mode);
    appearance.setTypography(new Typography());
    TestBed.tick();
    await shown.attachedAsync();
    await vi.waitFor(() => expect(shown.runtime.context.sent(TerminalNames.resizeMethod)).not.toHaveLength(0), { timeout: DrawnWait.milliseconds });
    shown.runtime.output("mine", 0, "$ ", [new TerminalInputMark(2, TerminalInputEdge.Start)]);
    return shown;
  };

  it.each(modes)("colors each part's cells in its kit code token and leaves the prompt and a plain argument, in %s mode", async mode => {
    const shown: PaneHost<TerminalPanelComponent> = await openAsync(mode, true);
    const plain: string = plainOf();
    const command: string = tokenOf(shown, "--nol-code-function");
    const option: string = tokenOf(shown, "--nol-code-keyword");
    const string: string = tokenOf(shown, "--nol-code-string");
    const path: string = tokenOf(shown, "--nol-code-type");
    const variable: string = tokenOf(shown, "--nol-code-variable");
    const operator: string = tokenOf(shown, "--nol-code-control");
    const colors: readonly string[] = [plain, command, option, string, path, variable, operator];
    const gap: undefined = undefined;

    shown.runtime.output("mine", 2, "ls -a x 'y' ~/z $v | wc");

    expect(new Set(colors).size).toBe(7);
    await DrawnWait.untilAsync(`The typed command in ${mode} mode`, () => drawnAsync(shown, colors, 25, `terminal-pane-command-colors-${mode}`), [
      plain, gap, command, command, gap, option, option, gap, plain, gap, string, string, string, gap, path, path, path, gap,
      variable, variable, gap, operator, gap, command, command
    ]);
  });

  it.each(modes)("colors a command the shell would find nowhere in the kit's error color, apart from a found one's, in %s mode", async mode => {
    const shown: PaneHost<TerminalPanelComponent> = await openAsync(mode, true, TerminalShellKind.Bash, runtime => {
      runtime.context.handlers.set(TerminalNames.findCommandsMethod, async () => new TerminalMissingCommands(["gti"]).toJson());
    });
    const plain: string = plainOf();
    const command: string = tokenOf(shown, "--nol-code-function");
    const missing: string = tokenOf(shown, "--nol-error");
    const operator: string = tokenOf(shown, "--nol-code-control");
    const gap: undefined = undefined;

    shown.runtime.output("mine", 2, "gti | wc");

    expect(new Set([plain, command, missing]).size).toBe(3);
    await DrawnWait.untilAsync(`The missing command in ${mode} mode`, () => drawnAsync(shown, [plain, command, missing, operator], 10, `terminal-pane-command-missing-${mode}`),
      [plain, gap, missing, missing, missing, gap, operator, gap, command, command]);
  });

  it("reads the line by PowerShell's rules for a PowerShell terminal, and colors its keywords and comments", async () => {
    const shown: PaneHost<TerminalPanelComponent> = await openAsync(ModePreference.Dark, true, TerminalShellKind.PowerShell);
    const plain: string = plainOf();
    const keyword: string = tokenOf(shown, "--nol-code-control");
    const operator: string = tokenOf(shown, "--nol-code-control");
    const command: string = tokenOf(shown, "--nol-code-function");
    const comment: string = tokenOf(shown, "--nol-code-comment");
    const gap: undefined = undefined;

    shown.runtime.output("mine", 2, "if { gci } # c");

    await DrawnWait.untilAsync("The PowerShell line", () => drawnAsync(shown, [plain, keyword, operator, command, comment], 16, "terminal-pane-command-colors-powershell"), [
      plain, gap, keyword, keyword, gap, operator, gap, command, command, command, gap, operator, gap, comment, gap, comment
    ]);
  });

  it("colors nothing in forced colors, where the kit colors no code", async () => {
    await cdp().send("Emulation.setEmulatedMedia", { features: [{ name: "forced-colors", value: "active" }] });
    const shown: PaneHost<TerminalPanelComponent> = await openAsync(ModePreference.Light, true);
    const plain: string = plainOf();
    const gap: undefined = undefined;

    shown.runtime.output("mine", 2, "ls -a");

    expect(window.matchMedia(Resources.forcedColorsQuery).matches).toBe(true);
    await DrawnWait.untilAsync("The typed command in forced colors", () => drawnAsync(shown, [plain], 7, "terminal-pane-command-colors-forced"),
      [plain, gap, plain, plain, gap, plain, plain]);
  });

  it("colors nothing while the setting is unset, and colors the line once it turns on", async () => {
    const shown: PaneHost<TerminalPanelComponent> = await openAsync(ModePreference.Light, null);
    shown.runtime.output("mine", 2, "ls");
    const plain: string = plainOf();
    const command: string = tokenOf(shown, "--nol-code-function");
    await DrawnWait.untilAsync("The line while the setting is unset", () => drawnAsync(shown, [plain, command], 4, "terminal-pane-command-colors-unset"),
      [plain, undefined, plain, plain]);

    shown.runtime.context.changeSetting(Resources.commandColorsSetting, true);

    await DrawnWait.untilAsync("The line once the setting turns on", () => drawnAsync(shown, [plain, command], 4, "terminal-pane-command-colors-on"),
      [plain, undefined, command, command]);
  });

  it("keeps a Command colors change that came before its setting was read over the read's older value", async () => {
    const shown: PaneHost<TerminalPanelComponent> = await openAsync(ModePreference.Light, null, TerminalShellKind.Bash, runtime => {
      runtime.context.answer("readSettingAsync", async name => {
        if (name === Resources.commandColorsSetting) {
          runtime.context.changeSetting(name, true);
          runtime.context.settings.set(name, false);
        }
        return runtime.context.entryOf(name);
      });
    });
    const plain: string = plainOf();
    const command: string = tokenOf(shown, "--nol-code-function");

    shown.runtime.output("mine", 2, "ls");

    await DrawnWait.untilAsync("The line after the earlier change", () => drawnAsync(shown, [plain, command], 4, "terminal-pane-command-colors-earlier-change"),
      [plain, undefined, command, command]);
  });

  describe("while it colors the line", () => {
    const typedAsync = async (): Promise<PaneHost<TerminalPanelComponent>> => {
      const shown: PaneHost<TerminalPanelComponent> = await openAsync(ModePreference.Light, true, TerminalShellKind.Bash, runtime => {
        runtime.context.handlers.set(TerminalNames.findCommandsMethod, async () => new TerminalMissingCommands(["gti"]).toJson());
      });
      shown.textarea.focus();
      await cdp().send("Input.insertText", { text: "gti" });
      shown.runtime.output("mine", 2, "gti");
      const missing: string = tokenOf(shown, "--nol-error");
      await DrawnWait.untilAsync("The typed missing command", async () => (await drawnAsync(shown, [plainOf(), missing], 5, "terminal-pane-command-colors-typed")).slice(2),
        [missing, missing, missing]);
      return shown;
    };
    const endAsync = async (shown: PaneHost<TerminalPanelComponent>, offset: number): Promise<void> => {
      const end: string = "\r\nnoldova-end";
      shown.runtime.output("mine", offset, end);
      await vi.waitFor(() => expect(shown.runtime.context.sent(TerminalNames.ackMethod).at(-1))
        .toEqual({ sessionId: "mine", paneId: expect.any(String), offset: offset + end.length }), { timeout: DrawnWait.milliseconds });
    };

    it("gives the shell only the person's keys", async () => {
      const shown: PaneHost<TerminalPanelComponent> = await typedAsync();

      await cdp().send("Input.insertText", { text: " -a" });
      shown.runtime.output("mine", 5, " -a");
      shown.press({ key: "Enter", code: "Enter", keyCode: 13 });
      await endAsync(shown, 8);

      expect(shown.inputs).toEqual(["gti", " -a", "\r"]);
    });

    it("gives the shell only the person's keys over a line continued after a \\", async () => {
      const shown: PaneHost<TerminalPanelComponent> = await typedAsync();

      await cdp().send("Input.insertText", { text: " \\" });
      shown.runtime.output("mine", 5, " \\");
      shown.press({ key: "Enter", code: "Enter", keyCode: 13 });
      shown.runtime.output("mine", 7, "\r\n> ", [new TerminalInputMark(11, TerminalInputEdge.Continuation)]);
      await cdp().send("Input.insertText", { text: "-a" });
      shown.runtime.output("mine", 11, "-a");
      shown.press({ key: "Enter", code: "Enter", keyCode: 13 });
      await endAsync(shown, 13);

      expect(shown.inputs).toEqual(["gti", " \\", "\r", "-a", "\r"]);
    });
  });
});
