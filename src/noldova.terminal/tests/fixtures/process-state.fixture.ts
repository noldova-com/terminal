/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { spawnSync, type SpawnSyncReturns } from "node:child_process";
import { readFileSync } from "node:fs";

export class ProcessState {
  public static isRunning(pid: number): boolean {
    switch (process.platform) {
      case "linux":
        return ProcessState.isRunningOnLinux(pid);
      case "darwin":
        return ProcessState.isRunningOnMac(pid);
      default:
        return ProcessState.answersSignal(pid);
    }
  }

  private static isRunningOnLinux(pid: number): boolean {
    let stat: string;
    try {
      stat = readFileSync(`/proc/${pid}/stat`, "utf8");
    }
    catch (error) {
      if (error instanceof Error && "code" in error && (error.code === "ENOENT" || error.code === "ESRCH"))
        return false;
      throw error;
    }
    const state: string | undefined = stat.slice(stat.lastIndexOf(")") + 1).trim()[0];
    return state !== "Z" && state !== "X";
  }

  private static isRunningOnMac(pid: number): boolean {
    const result: SpawnSyncReturns<string> = spawnSync("ps", ["-o", "stat=", "-p", String(pid)], { encoding: "utf8" });
    const state: string = result.stdout.trim();
    return state !== "" && !state.startsWith("Z");
  }

  private static answersSignal(pid: number): boolean {
    try {
      process.kill(pid, 0);
      return true;
    }
    catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ESRCH")
        return false;
      throw error;
    }
  }
}
