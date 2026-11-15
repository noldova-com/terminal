/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { MarkKind } from "../../src/enums/mark-kind.ts";
import { ShellMark } from "../../src/models/shell-mark.ts";
import type { TrackedCommand } from "../../src/models/tracked-command.ts";
import { CommandTracker } from "../../src/services/command-tracker.ts";

function trackText(text: string, ...marks: readonly ShellMark[]): CommandTracker {
  const tracker: CommandTracker = new CommandTracker((start, end) => text.slice(start, end));
  for (const mark of marks)
    tracker.apply(mark);
  return tracker;
}

function track(...marks: readonly ShellMark[]): CommandTracker {
  return trackText("", ...marks);
}

const PROMPT: string = "~/work$ ";

describe("CommandTracker", () => {
  it("knows nothing before the first mark", () => {
    const tracker: CommandTracker = track();

    assert.equal(tracker.hasMarks, false);
    assert.equal(tracker.isAtPrompt, false);
    assert.equal(tracker.promptEndOffset, null);
    assert.equal(tracker.promptIdentity, null);
    assert.equal(tracker.runningCommand, null);
    assert.equal(tracker.lastCommand, null);
  });

  it("knows the integration loaded from its loaded mark, which counts as no shell mark", () => {
    const before: CommandTracker = track();
    const tracker: CommandTracker = track(new ShellMark(MarkKind.Loaded, null, 0));

    assert.deepEqual([before.isLoaded, tracker.isLoaded, tracker.hasMarks, tracker.isAtPrompt], [false, true, false, false]);
  });

  it("stops waiting at the prompt once a line is entered there, until the next prompt ends, which keeps a line typed ahead of it", () => {
    const tracker: CommandTracker = track();
    const prompt = (offset: number): void => {
      tracker.apply(new ShellMark(MarkKind.PromptStart, null, offset));
      tracker.apply(new ShellMark(MarkKind.PromptEnd, null, offset + 8));
    };
    const command = (offset: number): void => {
      tracker.apply(new ShellMark(MarkKind.OutputStart, null, offset));
      tracker.apply(new ShellMark(MarkKind.CommandEnd, "0", offset + 10));
    };
    tracker.enterLine();
    prompt(0);
    const typedFirst: boolean = tracker.isWaitingAtPrompt;
    command(10);
    prompt(20);
    const waiting: boolean = tracker.isWaitingAtPrompt;
    tracker.enterLine();
    const entered: readonly boolean[] = [tracker.isAtPrompt, tracker.isWaitingAtPrompt];
    tracker.apply(new ShellMark(MarkKind.OutputStart, null, 30));
    tracker.enterLine();
    tracker.apply(new ShellMark(MarkKind.CommandEnd, "0", 40));
    prompt(40);
    const typedDuringCommand: boolean = tracker.isWaitingAtPrompt;
    command(50);
    prompt(60);

    assert.deepEqual([typedFirst, waiting, entered, typedDuringCommand, tracker.isWaitingAtPrompt], [false, true, [true, false], false, true]);
  });

  it("keeps a second line entered at the prompt before its first's command starts for the next prompt", () => {
    const tracker: CommandTracker = track(new ShellMark(MarkKind.PromptStart, null, 0), new ShellMark(MarkKind.PromptEnd, null, 8));
    tracker.enterLine();
    tracker.enterLine();
    tracker.apply(new ShellMark(MarkKind.OutputStart, null, 10));
    tracker.apply(new ShellMark(MarkKind.CommandEnd, "0", 20));
    tracker.apply(new ShellMark(MarkKind.PromptStart, null, 20));
    tracker.apply(new ShellMark(MarkKind.PromptEnd, null, 28));

    assert.equal(tracker.isWaitingAtPrompt, false);
  });

  it("follows a prompt, a command's output and its end, with the folder it ended in", () => {
    const tracker: CommandTracker = track(
      new ShellMark(MarkKind.Property, "Cwd=/work", 5),
      new ShellMark(MarkKind.PromptStart, null, 10),
      new ShellMark(MarkKind.PromptEnd, null, 20));

    assert.equal(tracker.hasMarks, true);
    assert.equal(tracker.isAtPrompt, true);
    assert.equal(tracker.promptEndOffset, 20);
    assert.equal(tracker.promptIdentity, 20);
    assert.equal(tracker.cwd, "/work");

    tracker.apply(new ShellMark(MarkKind.OutputStart, null, 30));
    assert.equal(tracker.promptEndOffset, null);
    assert.equal(tracker.promptIdentity, null);
    assert.equal(tracker.runningCommand?.outputStart, 30);
    assert.equal(tracker.runningCommand?.hasEnded, false);

    tracker.apply(new ShellMark(MarkKind.Property, "Path=/work/.venv/bin:/usr/bin", 85));
    tracker.apply(new ShellMark(MarkKind.Property, "Cwd=/work/src", 90));
    assert.deepEqual([tracker.path, tracker.cwd], ["/work/.venv/bin:/usr/bin", "/work/src"]);
    tracker.apply(new ShellMark(MarkKind.CommandEnd, "2", 100));
    const command: TrackedCommand | null = tracker.lastCommand;

    assert.equal(tracker.runningCommand, null);
    assert.equal(tracker.isAtPrompt, false);
    assert.deepEqual(
      [command?.outputStart, command?.hasOutputStart, command?.outputEnd, command?.exitCode, command?.cwd, command?.hasEnded],
      [30, true, 100, 2, "/work/src", true]);
  });

  it("knows whether the shell's hidden completion binding is in place from the last prompt that said so, and not before", () => {
    const tracker: CommandTracker = track(new ShellMark(MarkKind.Property, "Cwd=/work", 5));
    const before: boolean = tracker.hasOptionsBinding;
    tracker.apply(new ShellMark(MarkKind.Property, "Options=1", 10));
    const bound: boolean = tracker.hasOptionsBinding;
    tracker.apply(new ShellMark(MarkKind.Options, "--all", 12, ["--all"]));
    const answered: boolean = tracker.hasOptionsBinding;
    tracker.apply(new ShellMark(MarkKind.Property, "Options=0", 15));

    assert.deepEqual([before, bound, answered, tracker.hasOptionsBinding, tracker.isAtPrompt], [false, true, true, false, false]);
  });

  it("keeps the names a shell reports apart by spaces, none for an empty list, and forgets them at a reset, which it tells from none reported yet", () => {
    const unreported: boolean = new CommandTracker(() => "").isNamesReset;
    const tracker: CommandTracker = track(new ShellMark(MarkKind.Property, "Names=ll  gs __git_ps1 ", 5));
    const reported: readonly string[] = [...tracker.names ?? []];
    tracker.apply(new ShellMark(MarkKind.Property, "Names=", 10));
    const emptied: readonly string[] = [...tracker.names ?? ["unset"]];
    tracker.apply(new ShellMark(MarkKind.Property, "Names", 15));
    const forgotten: ReadonlySet<string> | null = tracker.names;
    const reset: boolean = tracker.isNamesReset;
    tracker.apply(new ShellMark(MarkKind.Property, "Names=ll", 20));

    assert.deepEqual([reported, emptied, forgotten, tracker.path], [["ll", "gs", "__git_ps1"], [], null, null]);
    assert.deepEqual([unreported, reset, tracker.isNamesReset, [...tracker.names ?? []]], [false, true, false, ["ll"]]);
  });

  it("keeps the builtins a shell reports apart from its names, so a names reset leaves them, and forgets them at their own reset", () => {
    const tracker: CommandTracker = track(new ShellMark(MarkKind.Property, "Builtins=cd if  export", 5));
    tracker.apply(new ShellMark(MarkKind.Property, "Names", 10));
    const kept: readonly string[] = [...tracker.builtins ?? []];
    tracker.apply(new ShellMark(MarkKind.Property, "Builtins", 15));

    assert.deepEqual([kept, tracker.builtins, tracker.names], [["cd", "if", "export"], null, null]);
  });

  it("keeps an empty PATH a shell reports, and forgets its PATH at a reset, back to none, until the next PATH it reports", () => {
    const tracker: CommandTracker = track(new ShellMark(MarkKind.Property, "Path=/usr/bin", 5));
    const reported: readonly (string | boolean | null)[] = [tracker.path, tracker.isPathReset];
    tracker.apply(new ShellMark(MarkKind.Property, "Path=", 10));
    const emptied: string | null = tracker.path;
    tracker.apply(new ShellMark(MarkKind.Property, "Path", 15));
    const reset: readonly (string | boolean | null)[] = [tracker.path, tracker.isPathReset, tracker.cwd];
    tracker.apply(new ShellMark(MarkKind.Property, "Path=/bin", 20));

    assert.deepEqual([...reported, emptied, ...reset, tracker.path, tracker.isPathReset], ["/usr/bin", false, "", null, true, null, "/bin", false]);
  });

  it("keeps the temporary folder Git Bash reports for its /tmp apart from its PATH, and forgets it at a reset", () => {
    const tracker: CommandTracker = track(new ShellMark(MarkKind.Property, "Temp=C:\\Users\\a\\tmp", 5));
    const reported: readonly (string | boolean | null)[] = [tracker.temporaryFolder, tracker.path, tracker.isPathReset];
    tracker.apply(new ShellMark(MarkKind.Property, "Temp", 10));

    assert.deepEqual([...reported, tracker.temporaryFolder], ["C:\\Users\\a\\tmp", null, false, null]);
  });

  it("keeps the PSModulePath PowerShell reports apart from its PATH, forgets it at a reset, which it marks, and takes the next one again", () => {
    const tracker: CommandTracker = track(new ShellMark(MarkKind.Property, "ModulePath=C:\\Modules", 5));
    const reported: readonly (string | boolean | null)[] = [tracker.modulePath, tracker.path, tracker.isModulePathReset];
    tracker.apply(new ShellMark(MarkKind.Property, "ModulePath", 10));
    const reset: readonly (string | boolean | null)[] = [tracker.modulePath, tracker.isModulePathReset, tracker.isPathReset];
    tracker.apply(new ShellMark(MarkKind.Property, "ModulePath=C:\\Mine", 15));

    assert.deepEqual([...reported, ...reset, tracker.modulePath, tracker.isModulePathReset], ["C:\\Modules", null, false, null, true, false, "C:\\Mine", false]);
  });

  it("counts each prompt the shell starts, a redraw's start too", () => {
    const tracker: CommandTracker = track();
    const before: number = tracker.prompts;
    tracker.apply(new ShellMark(MarkKind.PromptStart, null, 0));
    tracker.apply(new ShellMark(MarkKind.PromptEnd, null, 2));
    tracker.apply(new ShellMark(MarkKind.PromptStart, null, 4));

    assert.deepEqual([before, tracker.prompts], [0, 2]);
  });

  it("starts a command's output at the prompt's end when the shell gives no output mark", () => {
    const command: TrackedCommand | null = track(
      new ShellMark(MarkKind.PromptEnd, null, 20),
      new ShellMark(MarkKind.CommandEnd, "-1073741510", 70)).lastCommand;

    assert.deepEqual([command?.outputStart, command?.hasOutputStart, command?.exitCode], [20, false, -1_073_741_510]);
  });

  it("starts it at the end mark when no prompt came first", () => {
    assert.equal(track(new ShellMark(MarkKind.CommandEnd, "0", 70)).lastCommand?.outputStart, 70);
  });

  for (const value of [null, "", "x", "1.5", "12345678901"])
    it(`has no exit code for the end value ${JSON.stringify(value)}`, () => {
      assert.equal(track(new ShellMark(MarkKind.CommandEnd, value, 70)).lastCommand?.exitCode, null);
    });

  for (const value of [null, "Title=x"])
    it(`ignores the property ${JSON.stringify(value)}`, () => {
      assert.equal(track(new ShellMark(MarkKind.Property, value, 5)).cwd, null);
    });

  it("keeps a prompt drawn again whole, and starts the person's line after the new drawing", () => {
    const end: number = PROMPT.length;
    const tracker: CommandTracker = trackText(`${PROMPT}\n${PROMPT}`,
      new ShellMark(MarkKind.Property, "Cwd=/work", 0),
      new ShellMark(MarkKind.PromptStart, null, 0),
      new ShellMark(MarkKind.PromptEnd, null, end),
      new ShellMark(MarkKind.PromptStart, null, end),
      new ShellMark(MarkKind.PromptEnd, null, 2 * end + 1));

    assert.deepEqual([tracker.isAtPrompt, tracker.promptIdentity, tracker.promptEndOffset], [true, end, 2 * end + 1]);
  });

  it("keeps a prompt of several lines whose last line alone is drawn again, without its start mark", () => {
    const prompt: string = `[main] ~/work\n${PROMPT}`;
    const tracker: CommandTracker = trackText(`${prompt}\n${PROMPT}`,
      new ShellMark(MarkKind.PromptStart, null, 0),
      new ShellMark(MarkKind.PromptEnd, null, prompt.length),
      new ShellMark(MarkKind.PromptEnd, null, prompt.length + 1 + PROMPT.length));

    assert.deepEqual([tracker.promptIdentity, tracker.promptEndOffset], [prompt.length, prompt.length + 1 + PROMPT.length]);
  });

  it("takes a prompt of several lines as new when a print of its first line came before its last line's drawing", () => {
    const prompt: string = `[main] ~/work\n${PROMPT}`;
    const text: string = `${prompt}\n[main] ~/work\n${PROMPT}`;
    const tracker: CommandTracker = trackText(text,
      new ShellMark(MarkKind.PromptStart, null, 0),
      new ShellMark(MarkKind.PromptEnd, null, prompt.length),
      new ShellMark(MarkKind.PromptEnd, null, text.length));

    assert.deepEqual([tracker.promptIdentity, tracker.promptEndOffset], [text.length, text.length]);
  });

  it("takes a prompt whose last line is empty as new when a line end alone came before its drawing", () => {
    const prompt: string = "[main] ~/work\n";
    const text: string = `${prompt}\n`;
    const tracker: CommandTracker = trackText(text,
      new ShellMark(MarkKind.PromptStart, null, 0),
      new ShellMark(MarkKind.PromptEnd, null, prompt.length),
      new ShellMark(MarkKind.PromptEnd, null, text.length));

    assert.deepEqual([tracker.promptIdentity, tracker.promptEndOffset], [text.length, text.length]);
  });

  it("takes every end of a prompt whose start never came as a new prompt", () => {
    const text: string = `${PROMPT}\n`;
    const tracker: CommandTracker = trackText(text, new ShellMark(MarkKind.PromptEnd, null, PROMPT.length), new ShellMark(MarkKind.PromptEnd, null, text.length));

    assert.deepEqual([tracker.promptIdentity, tracker.promptEndOffset], [text.length, text.length]);
  });

  it("keeps the prompt through several drawings", () => {
    const end: number = PROMPT.length;
    const marks: ShellMark[] = [new ShellMark(MarkKind.PromptStart, null, 0), new ShellMark(MarkKind.PromptEnd, null, end)];
    for (let drawing: number = 1; drawing <= 3; drawing++)
      marks.push(new ShellMark(MarkKind.PromptStart, null, drawing * (end + 1) - 1), new ShellMark(MarkKind.PromptEnd, null, (drawing + 1) * (end + 1) - 1));

    assert.equal(trackText(PROMPT + `\n${PROMPT}`.repeat(3), ...marks).promptIdentity, end);
  });

  for (const [description, text, between] of [
    ["another prompt's text", `${PROMPT}\n# `, []],
    ["a folder report between, even of the same folder", `${PROMPT}\n${PROMPT}`, [new ShellMark(MarkKind.Property, "Cwd=/work", PROMPT.length)]],
    ["a command's end between", `${PROMPT}\n${PROMPT}`, [new ShellMark(MarkKind.CommandEnd, "0", PROMPT.length)]],
    ["a command's start between", `${PROMPT}\n${PROMPT}`, [new ShellMark(MarkKind.OutputStart, null, PROMPT.length)]],
    ["other output between", `${PROMPT}done\n${PROMPT}`, []],
    ["only line ends between", `${PROMPT}\n\n${PROMPT}`, []],
    ["only spaces between", `${PROMPT}\t \u3000\n${PROMPT}`, []],
    ["a second prompt start between", `${PROMPT}\n${PROMPT}`, [new ShellMark(MarkKind.PromptStart, null, PROMPT.length)]]
  ] as const)
    it(`takes a prompt end after ${description} as a new prompt`, () => {
      const end: number = text.length;
      const tracker: CommandTracker = trackText(text,
        new ShellMark(MarkKind.Property, "Cwd=/work", 0),
        new ShellMark(MarkKind.PromptStart, null, 0),
        new ShellMark(MarkKind.PromptEnd, null, PROMPT.length),
        ...between,
        new ShellMark(MarkKind.PromptStart, null, text.lastIndexOf("\n")),
        new ShellMark(MarkKind.PromptEnd, null, end));

      assert.deepEqual([tracker.isAtPrompt, tracker.promptIdentity, tracker.promptEndOffset], [true, end, end]);
    });
});
