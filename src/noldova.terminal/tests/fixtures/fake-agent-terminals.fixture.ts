/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import { CommandStatus } from "../../src/tools/enums/command-status.ts";
import { RunMethod } from "../../src/tools/enums/run-method.ts";
import { StaleTerminalException } from "../../src/tools/exceptions/stale-terminal.exception.ts";
import type { IAgentCommand } from "../../src/tools/interfaces/i-agent-command.ts";
import type { IAgentTerminal } from "../../src/tools/interfaces/i-agent-terminal.ts";
import type { IAgentTerminals } from "../../src/tools/interfaces/i-agent-terminals.ts";
import type { IOutputSource } from "../../src/tools/interfaces/i-output-source.ts";
import type { ITerminalPrompt } from "../../src/tools/interfaces/i-terminal-prompt.ts";
import type { AgentTerminalOpening } from "../../src/tools/models/agent-terminal-opening.ts";
import { OutputChunk } from "../../src/tools/models/output-chunk.ts";

export class FakeTerminalPrompt implements ITerminalPrompt {
  public readonly isIdle: boolean;
  public readonly cwd: string | null;
  public readonly promptOffset: number | null;
  public readonly isAwaitingSecret: boolean;
  public readonly inputCount: number;

  public constructor(isIdle: boolean, cwd: string | null, promptOffset: number | null = null, isAwaitingSecret: boolean = false, inputCount: number = 0) {
    this.isIdle = isIdle;
    this.cwd = cwd;
    this.promptOffset = promptOffset;
    this.isAwaitingSecret = isAwaitingSecret;
    this.inputCount = inputCount;
  }

  public equals(other: ITerminalPrompt): boolean {
    return other.isIdle === this.isIdle && other.cwd === this.cwd && other.promptOffset === this.promptOffset && other.isAwaitingSecret === this.isAwaitingSecret
      && other.inputCount === this.inputCount;
  }
}

export class FakeOutputSource implements IOutputSource {
  public output: string = "";
  public onWait: (() => void) | null = null;
  public readonly outputWaits: { readonly offset: number; readonly timeoutMilliseconds: number; readonly signal: AbortSignal }[] = [];

  public readSince(offset: number): OutputChunk {
    return new OutputChunk(this.output.slice(offset), this.output.length);
  }

  public async waitForOutputAsync(offset: number, timeoutMilliseconds: number, signal: AbortSignal): Promise<void> {
    this.outputWaits.push({ offset, timeoutMilliseconds, signal });
    this.onWait?.();
  }
}

export class FakeAgentCommand extends FakeOutputSource implements IAgentCommand {
  public method: RunMethod = RunMethod.InShell;
  public status: CommandStatus = CommandStatus.Running;
  public exitCode: number | null = null;
  public cwd: string | null = null;
  public readonly logFile: string = "/logs/command-1.log";
  public readonly endWaits: { readonly timeoutMilliseconds: number; readonly signal: AbortSignal }[] = [];
  public interrupts: number = 0;

  public async waitForEndAsync(timeoutMilliseconds: number, signal: AbortSignal): Promise<void> {
    this.endWaits.push({ timeoutMilliseconds, signal });
    this.onWait?.();
  }

  public interrupt(): boolean {
    if (this.status === CommandStatus.Exited || this.status === CommandStatus.Killed)
      return false;
    this.interrupts++;
    this.status = CommandStatus.Killed;
    return true;
  }

  public finish(exitCode: number, cwd: string): void {
    this.status = CommandStatus.Exited;
    this.exitCode = exitCode;
    this.cwd = cwd;
  }
}

export class FakeAgentTerminal extends FakeOutputSource implements IAgentTerminal {
  public readonly id: string;
  public readonly ownerSessionId: string | null;
  public readonly owner: string | null;
  public title: string = "bash - project";
  public name: string | null = null;
  public readonly shellName: string = "Bash";
  public readonly shellId: string = "bash";
  public readonly shellPath: string = "/bin/bash";
  public readonly startFolder: string = "/work/start";
  public hasShellIntegration: boolean = true;
  public oneShotProgram: string | null = null;
  public isRunning: boolean = true;
  public isAwaitingSecret: boolean = false;
  public hasPendingLine: boolean = false;
  public prompt: FakeTerminalPrompt = new FakeTerminalPrompt(true, "/work/project");
  public nextCommand: FakeAgentCommand = new FakeAgentCommand();
  public readonly runs: { readonly command: string; readonly timeoutMilliseconds: number }[] = [];
  public readonly writes: string[] = [];
  public interrupts: number = 0;
  public onClosing: (() => void) | null = null;
  public closes: number = 0;

  public constructor(id: string, ownerSessionId: string | null, owner: string | null = null) {
    super();

    this.id = id;
    this.ownerSessionId = ownerSessionId;
    this.owner = owner;
  }

  public readPrompt(): ITerminalPrompt {
    return this.prompt;
  }

  public readOneShotLine(command: string): string | null {
    return Object.isNull(this.oneShotProgram) ? null : `${this.oneShotProgram} ${command}`;
  }

  public run(command: string, expected: ITerminalPrompt, timeoutMilliseconds: number): IAgentCommand {
    this.requireExpected(expected);
    this.runs.push({ command, timeoutMilliseconds });
    return this.nextCommand;
  }

  public write(keys: string, expected: ITerminalPrompt): void {
    this.requireExpected(expected);
    this.writes.push(keys);
  }

  public interrupt(expected: ITerminalPrompt): void {
    this.requireExpected(expected);
    this.interrupts++;
  }

  public async closeAsync(): Promise<void> {
    this.closes++;
    this.onClosing?.();
    this.isRunning = false;
  }

  private requireExpected(expected: ITerminalPrompt): void {
    if (!this.prompt.equals(expected))
      throw new StaleTerminalException(this.id);
  }
}

export class FakeAgentTerminals implements IAgentTerminals {
  public readonly terminals: FakeAgentTerminal[] = [];
  public readonly openings: AgentTerminalOpening[] = [];
  public readonly openSignals: AbortSignal[] = [];
  public onOpening: (() => void) | null = null;
  public onSessionEnded: ((agentSessionId: string) => void) | null = null;
  public readonly sessionOwners: Map<string, string> = new Map<string, string>();
  public readonly endedSessions: string[] = [];

  public add(id: string, ownerSessionId: string | null, owner: string | null = null): FakeAgentTerminal {
    const terminal: FakeAgentTerminal = new FakeAgentTerminal(id, ownerSessionId, owner);
    this.terminals.push(terminal);
    return terminal;
  }

  public list(): readonly IAgentTerminal[] {
    return this.terminals;
  }

  public find(id: string): IAgentTerminal | undefined {
    return this.terminals.find(t => t.id === id);
  }

  public async openAsync(opening: AgentTerminalOpening, signal: AbortSignal): Promise<IAgentTerminal> {
    this.openings.push(opening);
    this.openSignals.push(signal);
    this.onOpening?.();
    return this.add(`opened-${this.openings.length}`, opening.ownerSessionId, this.findSessionOwner(opening.ownerSessionId) ?? opening.owner);
  }

  public findSessionOwner(agentSessionId: string): string | null {
    return this.sessionOwners.get(agentSessionId) ?? null;
  }

  public endSession(agentSessionId: string): void {
    this.endedSessions.push(agentSessionId);
    this.sessionOwners.delete(agentSessionId);
    this.onSessionEnded?.(agentSessionId);
  }
}
