/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { MarkKind } from "../enums/mark-kind.ts";
import type { ShellMark } from "../models/shell-mark.ts";
import { TrackedCommand } from "../models/tracked-command.ts";
import { Resources } from "../resources.ts";

export class CommandTracker {
  private readonly read: (start: number, end: number) => string;
  private promptOffset: number | null = null;
  private lineOffset: number | null = null;
  private promptText: string | null = null;
  private promptStart: number | null = null;
  private canRedraw: boolean = false;
  private redrawFrom: number | null = null;
  private current: TrackedCommand | null = null;
  private hasTypedAhead: boolean = false;

  public hasMarks: boolean = false;
  public isAtPrompt: boolean = false;
  public hasEnteredLine: boolean = false;
  public cwd: string | null = null;
  public path: string | null = null;
  public isPathReset: boolean = false;
  public temporaryFolder: string | null = null;
  public modulePath: string | null = null;
  public isModulePathReset: boolean = false;
  public names: ReadonlySet<string> | null = null;
  public isNamesReset: boolean = false;
  public builtins: ReadonlySet<string> | null = null;
  public hasOptionsBinding: boolean = false;
  public isLoaded: boolean = false;
  public lastCommand: TrackedCommand | null = null;
  public prompts: number = 0;
  public commandMarks: number = 0;

  public constructor(read: (start: number, end: number) => string) {
    this.read = read;
  }

  public get runningCommand(): TrackedCommand | null {
    return this.current;
  }

  public get promptEndOffset(): number | null {
    return this.isAtPrompt ? this.lineOffset : null;
  }

  public get promptIdentity(): number | null {
    return this.isAtPrompt ? this.promptOffset : null;
  }

  public get isWaitingAtPrompt(): boolean {
    return this.isAtPrompt && !this.hasEnteredLine;
  }

  public enterLine(): void {
    if (this.isWaitingAtPrompt)
      this.hasEnteredLine = true;
    else
      this.hasTypedAhead = true;
  }

  public apply(mark: ShellMark): void {
    if (mark.kind === MarkKind.Loaded) {
      this.isLoaded = true;
      return;
    }
    this.hasMarks = true;
    switch (mark.kind) {
      case MarkKind.PromptStart:
        this.redrawFrom = this.canRedraw ? this.lineOffset : null;
        this.canRedraw = false;
        this.isAtPrompt = false;
        this.promptStart = mark.offset;
        this.prompts++;
        break;
      case MarkKind.PromptEnd:
        this.endPrompt(mark.offset);
        break;
      case MarkKind.OutputStart:
        this.stopRedraws();
        this.isAtPrompt = false;
        this.current = new TrackedCommand(mark.offset, true);
        this.commandMarks++;
        break;
      case MarkKind.CommandEnd:
        this.stopRedraws();
        this.commandMarks++;
        this.end(mark);
        break;
      case MarkKind.Property:
        this.stopRedraws();
        if (mark.value?.startsWith(Resources.cwdProperty) === true)
          this.cwd = mark.value.slice(Resources.cwdProperty.length);
        else if (mark.value?.startsWith(Resources.pathProperty) === true) {
          this.path = mark.value.slice(Resources.pathProperty.length);
          this.isPathReset = false;
        }
        else if (mark.value === Resources.pathReset) {
          this.path = null;
          this.isPathReset = true;
        }
        else if (mark.value?.startsWith(Resources.temporaryFolderProperty) === true)
          this.temporaryFolder = mark.value.slice(Resources.temporaryFolderProperty.length);
        else if (mark.value === Resources.temporaryFolderReset)
          this.temporaryFolder = null;
        else if (mark.value?.startsWith(Resources.modulePathProperty) === true) {
          this.modulePath = mark.value.slice(Resources.modulePathProperty.length);
          this.isModulePathReset = false;
        }
        else if (mark.value === Resources.modulePathReset) {
          this.modulePath = null;
          this.isModulePathReset = true;
        }
        else if (mark.value?.startsWith(Resources.namesProperty) === true) {
          this.names = new Set(mark.value.slice(Resources.namesProperty.length).split(Resources.namesSeparator).filter(t => t !== ""));
          this.isNamesReset = false;
        }
        else if (mark.value === Resources.namesReset) {
          this.names = null;
          this.isNamesReset = true;
        }
        else if (mark.value?.startsWith(Resources.builtinsProperty) === true)
          this.builtins = new Set(mark.value.slice(Resources.builtinsProperty.length).split(Resources.namesSeparator).filter(t => t !== ""));
        else if (mark.value === Resources.builtinsReset)
          this.builtins = null;
        else if (mark.value?.startsWith(Resources.optionsProperty) === true)
          this.hasOptionsBinding = mark.value.slice(Resources.optionsProperty.length) === Resources.optionsBound;
        break;
    }
  }

  private endPrompt(offset: number): void {
    const from: number | null = this.canRedraw ? this.lineOffset : this.redrawFrom;
    const drawn: string | null = this.canRedraw ? CommandTracker.lastLine(this.promptText) : this.promptText;
    if (from === null || drawn === null || CommandTracker.drawing(this.read(from, offset)) !== drawn) {
      this.promptOffset = offset;
      this.promptText = this.promptStart === null ? null : CommandTracker.drawing(this.read(this.promptStart, offset));
    }
    this.lineOffset = offset;
    this.promptStart = null;
    this.redrawFrom = null;
    this.canRedraw = true;
    this.isAtPrompt = true;
    this.hasEnteredLine = this.hasTypedAhead;
    this.hasTypedAhead = false;
  }

  private static drawing(text: string): string {
    return text.length > 1 && text.startsWith(Resources.lineFeed) ? text.slice(1) : text;
  }

  private static lastLine(text: string | null): string | null {
    return text === null ? null : text.slice(text.lastIndexOf(Resources.lineFeed) + 1);
  }

  private stopRedraws(): void {
    this.canRedraw = false;
    this.redrawFrom = null;
  }

  private end(mark: ShellMark): void {
    const command: TrackedCommand = this.current ?? new TrackedCommand(this.lineOffset ?? mark.offset, false);
    const exitCode: number | null = mark.value !== null && Resources.commandTrackerExitCode.test(mark.value) ? Number.parseInt(mark.value, Resources.decimalRadix) : null;
    command.end(mark.offset, exitCode, this.cwd);
    this.isAtPrompt = false;
    this.current = null;
    this.lastCommand = command;
  }
}
