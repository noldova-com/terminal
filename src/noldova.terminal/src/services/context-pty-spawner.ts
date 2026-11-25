/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import { type IPseudoTerminalLibrary, type IRuntimePartContext, type PseudoTerminal, PseudoTerminalRequest } from "@noldova/desktop.runtime";

import type { IPtyProcess } from "../interfaces/i-pty-process.ts";
import type { IPtySpawner } from "../interfaces/i-pty-spawner.ts";
import { ContextPtyProcess } from "./context-pty-process.ts";

export class ContextPtySpawner implements IPtySpawner {
  private readonly context: IRuntimePartContext;
  private library: Promise<IPseudoTerminalLibrary> | undefined;

  public constructor(context: IRuntimePartContext) {
    this.context = context;
    this.library = undefined;
  }

  public async spawnAsync(
    file: string,
    args: readonly string[] | string,
    folder: string,
    columns: number,
    rows: number,
    environment: Readonly<Record<string, string>>,
    inheritCursor: boolean): Promise<IPtyProcess> {
    this.library ??= import("node-pty");
    const library: IPseudoTerminalLibrary = await this.library;
    const request: PseudoTerminalRequest = Object.isString(args)
      ? new PseudoTerminalRequest(library, file, [], folder, columns, rows, environment, { inheritCursor, commandLine: args })
      : new PseudoTerminalRequest(library, file, args, folder, columns, rows, environment, { inheritCursor });
    const terminal: PseudoTerminal = await this.context.startPseudoTerminalAsync(request);
    return new ContextPtyProcess(terminal);
  }
}
