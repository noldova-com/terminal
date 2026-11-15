/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/context.exceptions";
import type { IWindowPartContext } from "@noldova/desktop.window";
import { ArgumentValidator, Resources as ProtocolResources, TerminalNames, TerminalOwnerReference, TerminalRunBusy, TerminalRunOutcome, TerminalShellKind,
  type ArgumentProblem, type TerminalRunOutput, type TerminalRunResult, type TerminalSummary } from "@noldova/terminal.protocol";

import { Resources } from "../../resources.ts";
import { OwnersProvidedException } from "../exceptions/owners-provided.exception.ts";
import { RunArgumentRefusedException } from "../exceptions/run-argument-refused.exception.ts";
import { RunLinesRefusedException } from "../exceptions/run-lines-refused.exception.ts";
import { RunPartInactiveException } from "../exceptions/run-part-inactive.exception.ts";
import { RunShellKindsMissingException } from "../exceptions/run-shell-kinds-missing.exception.ts";
import { TerminalRunNotFoundException } from "../exceptions/terminal-run-not-found.exception.ts";
import { TerminalRunNotTypedException } from "../exceptions/terminal-run-not-typed.exception.ts";
import { TerminalRun } from "../models/terminal-run.ts";
import type { TerminalRunTarget } from "../models/terminal-run-target.ts";
import { TerminalFocus } from "./terminal-focus.ts";
import { TerminalPart } from "./terminal-part.ts";
import { TerminalRunEnds } from "./terminal-run-ends.ts";
import { TerminalRunNotices } from "./terminal-run-notices.ts";
import { TerminalRuntimeClient } from "./terminal-runtime-client.ts";

export class TerminalOwners {
  public static readonly maximumCommandLength: number = ProtocolResources.maximumCommandLength;
  public static readonly defaultRunLines: number = Resources.defaultRunLines;
  public static readonly maximumRunLines: number = ProtocolResources.maximumRunLines;
  public static readonly defaultColor: number = ProtocolResources.defaultColor;
  public static readonly rgbColor: number = ProtocolResources.rgbColor;

  private static current: TerminalOwners | null = null;
  private readonly context: IWindowPartContext;
  private readonly newOwner: () => string | null;
  private readonly client: TerminalRuntimeClient;
  private shownOwner: string | null = null;
  private showing: Promise<void> = Promise.resolve();
  private runsWithoutTab: Promise<unknown> = Promise.resolve();
  private noticed: ((sessionId: string) => void) | null = null;
  private readonly stopNotices: () => void;
  private readonly report: () => void = () => void this.reportAsync();

  private constructor(context: IWindowPartContext, newOwner: () => string | null) {
    this.context = context;
    this.newOwner = newOwner;
    this.client = new TerminalRuntimeClient(context);
    this.stopNotices = TerminalRunNotices.listen(t => this.notice(t));
  }

  public static get shown(): string | null {
    return TerminalOwners.current?.shownOwner ?? null;
  }

  public static provide(context: IWindowPartContext, newOwner: () => string | null): TerminalOwners {
    if (TerminalOwners.current !== null)
      throw new OwnersProvidedException();
    const owners: TerminalOwners = new TerminalOwners(context, newOwner);
    TerminalOwners.current = owners;
    document.addEventListener(Resources.visibilityChangeEvent, owners.report);
    return owners;
  }

  public static readNewOwner(): string | null {
    const owners: TerminalOwners | null = TerminalOwners.current;
    if (owners === null)
      return null;
    try {
      const owner: string | null = owners.newOwner();
      if (owner !== null)
        ArgumentValidator.requireNonBlank(Resources.ownerArgument, owner, ProtocolResources.maximumOwnerLength);
      return owner;
    }
    catch (error) {
      owners.context.log(Resources.formatNewOwnerFailed(String(error)));
      return null;
    }
  }

  public static canRun(command: string): boolean {
    try {
      ArgumentValidator.requireScript(Resources.commandArgument, command);
      return true;
    }
    catch (error) {
      if (error instanceof ArgumentException)
        return false;
      throw error;
    }
  }

  public async runAsync(owner: string, command: string, folder: string | null, shellKinds: readonly TerminalShellKind[]): Promise<string> {
    return (await this.startRunAsync(owner, command, folder, shellKinds, null)).sessionId;
  }

  public async startRunAsync(owner: string, command: string, folder: string | null, shellKinds: readonly TerminalShellKind[],
    target: TerminalRunTarget | null, shown: ((sessionId: string) => void) | null = null): Promise<TerminalRun> {
    if (shown === null)
      return this.startRunNowAsync(owner, command, folder, shellKinds, target, null);
    const run: Promise<TerminalRun> = this.runsWithoutTab.then(() => this.startRunNowAsync(owner, command, folder, shellKinds, target, shown));
    this.runsWithoutTab = run.catch(() => undefined);
    return run;
  }

  public async readRunOutputAsync(run: TerminalRun, maximumLines: number = TerminalOwners.defaultRunLines): Promise<TerminalRunOutput> {
    if (!(Number.isInteger(maximumLines) && maximumLines >= 1 && maximumLines <= TerminalOwners.maximumRunLines))
      throw new RunLinesRefusedException(maximumLines, TerminalOwners.maximumRunLines);
    if (ArgumentValidator.findIdentifierProblem(Resources.sessionIdArgument, run.sessionId) !== null
      || ArgumentValidator.findIdentifierProblem(Resources.runIdArgument, run.runId) !== null)
      throw new TerminalRunNotFoundException(run.sessionId, run.runId);
    const output: TerminalRunOutput | null = await this.client.readRunOutputAsync(run.sessionId, run.runId, maximumLines);
    if (output === null)
      throw new TerminalRunNotFoundException(run.sessionId, run.runId);
    return output;
  }

  public showAsync(owner: string | null): Promise<void> {
    if (owner !== null)
      ArgumentValidator.requireNonBlank(Resources.ownerArgument, owner, ProtocolResources.maximumOwnerLength);
    const showing: Promise<void> = this.showing.then(() => this.showNowAsync(owner));
    this.showing = showing.catch(() => undefined);
    return showing;
  }

  public async closeAsync(owner: string): Promise<void> {
    await this.context.requestAsync(TerminalNames.closeOwnerMethod, new TerminalOwnerReference(owner).toJson());
  }

  public async removeAsync(): Promise<void> {
    if (TerminalOwners.current !== this)
      return;
    try {
      await this.showAsync(null);
    }
    finally {
      document.removeEventListener(Resources.visibilityChangeEvent, this.report);
      this.stopNotices();
      TerminalOwners.current = null;
    }
  }

  private static findRunProblem(owner: string, command: string, folder: string | null, shellKinds: readonly TerminalShellKind[],
    target: TerminalRunTarget | null): ArgumentProblem | null {
    return ArgumentValidator.findNonBlankProblem(Resources.ownerArgument, owner, ProtocolResources.maximumOwnerLength)
      ?? ArgumentValidator.findScriptProblem(Resources.commandArgument, command)
      ?? (folder === null ? null : ArgumentValidator.findAbsolutePathProblem(Resources.folderArgument, folder))
      ?? ArgumentValidator.findEachOneOfProblem(Resources.shellKindsArgument, shellKinds, Object.values(TerminalShellKind))
      ?? (target === null ? null : ArgumentValidator.findIdentifierProblem(Resources.sessionIdArgument, target.sessionId)
        ?? ArgumentValidator.findOneOfProblem(Resources.whenBusyArgument, target.whenBusy, Object.values(TerminalRunBusy)));
  }

  private async startRunNowAsync(owner: string, command: string, folder: string | null, shellKinds: readonly TerminalShellKind[],
    target: TerminalRunTarget | null, shown: ((sessionId: string) => void) | null): Promise<TerminalRun> {
    const part: IWindowPartContext | null = TerminalPart.context;
    if (part === null)
      throw new RunPartInactiveException();
    const problem: ArgumentProblem | null = TerminalOwners.findRunProblem(owner, command, folder, shellKinds, target);
    if (problem !== null)
      throw new RunArgumentRefusedException(problem.parameterName, problem.reason);
    if (target !== null)
      shown?.(target.sessionId);
    else if (shown !== null)
      this.noticed = shown;
    let result: TerminalRunResult;
    let missed: ((sessionId: string) => void) | null = null;
    try {
      result = await this.client.runAsync(owner, command, folder, shellKinds, target, shown === null);
    }
    finally {
      if (this.noticed === shown) {
        missed = this.noticed;
        this.noticed = null;
      }
    }
    const sessionId: string | null = result.sessionId;
    if (sessionId === null)
      throw new RunShellKindsMissingException(shellKinds);
    missed?.(sessionId);
    const isShown: () => boolean = () => target === null && shown === null && TerminalPart.context === part && owner === TerminalOwners.shown;
    if (isShown() && await this.isListedAsync(result) && !await TerminalFocus.showAsync(sessionId))
      await new TerminalRuntimeClient(part).openTabsAsync([sessionId], null, isShown);
    const runId: string | null = result.runId;
    if (runId === null)
      throw new TerminalRunNotTypedException(sessionId, result.outcome);
    for (const ended of result.endedRuns)
      TerminalRunEnds.end(ended);
    return new TerminalRun(sessionId, runId, TerminalRunEnds.waitAsync(runId));
  }

  private notice(sessionId: string): void {
    const shown: ((sessionId: string) => void) | null = this.noticed;
    if (shown === null)
      return;
    this.noticed = null;
    shown(sessionId);
  }

  private async isListedAsync(result: TerminalRunResult): Promise<boolean> {
    if (result.outcome !== TerminalRunOutcome.Ended)
      return true;
    try {
      return (await this.client.listAsync()).some(t => t.sessionId === result.sessionId);
    }
    catch (error) {
      this.context.log(Resources.formatRunListFailed(error));
      return false;
    }
  }

  private reportAsync(): Promise<void> {
    const reporting: Promise<void> = this.showing.then(() => this.tellShownAsync());
    this.showing = reporting;
    return reporting;
  }

  private async tellShownAsync(): Promise<void> {
    if (TerminalOwners.current !== this)
      return;
    try {
      await this.client.showOwnerAsync(TerminalOwners.shown);
    }
    catch (error) {
      this.context.log(Resources.formatShowOwnerFailed(error));
    }
  }

  private async showNowAsync(owner: string | null): Promise<void> {
    if (TerminalOwners.current !== this || owner === this.shownOwner)
      return;
    const part: IWindowPartContext | null = TerminalPart.context;
    const isServed: () => boolean = () => TerminalPart.context === part;
    const owned: readonly TerminalSummary[] = part === null ? [] : (await this.client.listAsync()).filter(t => t.owner !== null);
    this.shownOwner = owner;
    await this.tellShownAsync();
    if (part === null || !isServed())
      return;
    for (const terminal of owned)
      if (terminal.owner !== owner)
        part.closeView(Resources.sessionView, terminal.sessionId);
    await new TerminalRuntimeClient(part).openTabsAsync(owned.filter(t => t.owner === owner && t.opensTab).map(t => t.sessionId), null, isServed);
  }
}
