/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TerminalRunEndedBy, type TerminalRunEnded } from "@noldova/terminal.protocol";

import { Resources } from "../../resources.ts";
import { TerminalRunEnd } from "../models/terminal-run-end.ts";

export class TerminalRunEnds {
  private static readonly waiting: Map<string, (end: TerminalRunEnd) => void> = new Map<string, (end: TerminalRunEnd) => void>();
  private static readonly early: Map<string, TerminalRunEnd> = new Map<string, TerminalRunEnd>();

  public static waitAsync(runId: string): Promise<TerminalRunEnd> {
    const end: TerminalRunEnd | undefined = TerminalRunEnds.early.get(runId);
    TerminalRunEnds.early.delete(runId);
    return end !== undefined ? Promise.resolve(end) : new Promise<TerminalRunEnd>(resolve => TerminalRunEnds.waiting.set(runId, resolve));
  }

  public static end(ended: TerminalRunEnded): void {
    const end: TerminalRunEnd = new TerminalRunEnd(ended.endedBy, ended.exitCode);
    const resolve: ((end: TerminalRunEnd) => void) | undefined = TerminalRunEnds.waiting.get(ended.runId);
    if (resolve !== undefined) {
      TerminalRunEnds.waiting.delete(ended.runId);
      resolve(end);
      return;
    }
    TerminalRunEnds.early.set(ended.runId, end);
    for (const runId of [...TerminalRunEnds.early.keys()].slice(0, Math.max(0, TerminalRunEnds.early.size - Resources.keptEarlyRunEnds)))
      TerminalRunEnds.early.delete(runId);
  }

  public static detachAll(): void {
    const waiting: readonly ((end: TerminalRunEnd) => void)[] = [...TerminalRunEnds.waiting.values()];
    TerminalRunEnds.waiting.clear();
    TerminalRunEnds.early.clear();
    for (const resolve of waiting)
      resolve(new TerminalRunEnd(TerminalRunEndedBy.TerminalEnded, null));
  }
}
