/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { afterEach, describe, expect, it } from "vitest";

import { TerminalRunNotices } from "../../../src/app/services/terminal-run-notices.ts";

describe("TerminalRunNotices", () => {
  const stops: (() => void)[] = [];

  afterEach(() => {
    for (const stop of stops.splice(0))
      stop();
  });

  it("hands each notice to the listener until its stop runs, and drops notices after", () => {
    const noticed: string[] = [];
    const stop: () => void = TerminalRunNotices.listen(t => noticed.push(t));
    stops.push(stop);

    TerminalRunNotices.notice("run-1");
    stop();
    TerminalRunNotices.notice("run-2");

    expect(noticed).toEqual(["run-1"]);
  });

  it("hands notices to the latest listener, which an earlier listener's stop leaves in place", () => {
    const noticed: string[] = [];
    const stopFirst: () => void = TerminalRunNotices.listen(t => noticed.push(`first ${t}`));
    const stopLater: () => void = TerminalRunNotices.listen(t => noticed.push(`later ${t}`));
    stops.push(stopFirst, stopLater);

    stopFirst();
    TerminalRunNotices.notice("run-1");

    expect(noticed).toEqual(["later run-1"]);
  });

  it("drops a notice while nothing listens", () => {
    expect(() => TerminalRunNotices.notice("run-1")).not.toThrow();
  });
});
