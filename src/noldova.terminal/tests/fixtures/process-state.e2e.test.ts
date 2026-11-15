/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { Writable } from "node:stream";

import { describe, expect, it, vi } from "vitest";

import { ProcessState } from "./process-state.fixture.ts";

const WAIT_MS: number = 10_000;
const POLL_MS: number = 25;

function commandOf(pid: number): string {
  return execFileSync("ps", ["-o", "comm=", "-p", String(pid)], { encoding: "utf8" }).trim();
}

describe("ProcessState", () => {
  it("counts a zombie, which still answers a signal check, as ended, a running process as running, and one that is gone as ended", async context => {
    context.skip(process.platform === "win32", "Windows has no zombie processes and no sh to make one.");
    const parent: ChildProcess = spawn("sh", ["-c", "read line <&3 & echo $!; exec sleep 30 3<&-"], { stdio: ["ignore", "pipe", "ignore", "pipe"] });
    const exited: Promise<unknown[]> = once(parent, "exit");
    try {
      const output: NodeJS.ReadableStream | null = parent.stdout;
      const release: unknown = parent.stdio[3];
      if (parent.pid === undefined || output === null || !(release instanceof Writable))
        throw new Error("The shell did not start with its pipes.");
      const pid: number = parent.pid;
      const [line] = await once(output, "data") as [Buffer];
      const zombie: number = Number(line.toString().trim());
      await vi.waitFor(() => expect(commandOf(pid), `The shell ${pid} did not become sleep.`).toMatch(/sleep$/u), { timeout: WAIT_MS, interval: POLL_MS });
      expect(ProcessState.isRunning(zombie)).toBe(true);

      release.end("\n");

      await vi.waitFor(() => expect(ProcessState.isRunning(zombie), `The released child ${zombie} still counts as running.`).toBe(false),
        { timeout: WAIT_MS, interval: POLL_MS });

      expect(() => process.kill(zombie, 0)).not.toThrow();
      expect(ProcessState.isRunning(pid)).toBe(true);
      parent.kill("SIGKILL");
      await exited;
      expect(ProcessState.isRunning(pid)).toBe(false);
    }
    finally {
      parent.kill("SIGKILL");
    }
  });
});
