/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import type { IWindowPartContext } from "@noldova/desktop.window";
import { FakeWindowPartContext } from "@noldova/desktop.window/testing";
import { afterEach, describe, expect, it } from "vitest";

import { TerminalPart } from "../../../src/app/services/terminal-part.ts";

describe("TerminalPart", () => {
  afterEach(() => {
    const served: IWindowPartContext | null = TerminalPart.context;
    if (!Object.isNull(served))
      TerminalPart.serve(served)();
  });

  it("gives the context it serves until its stop runs, and none after", () => {
    const part: FakeWindowPartContext = new FakeWindowPartContext();

    const stop: () => void = TerminalPart.serve(part);
    expect(TerminalPart.context).toBe(part);
    stop();
    expect(TerminalPart.context).toBeNull();
  });

  it("gives the latest context served, which an earlier context's stop leaves served", () => {
    const first: FakeWindowPartContext = new FakeWindowPartContext();
    const later: FakeWindowPartContext = new FakeWindowPartContext();

    const stopFirst: () => void = TerminalPart.serve(first);
    const stopLater: () => void = TerminalPart.serve(later);
    expect(TerminalPart.context).toBe(later);
    stopFirst();
    expect(TerminalPart.context).toBe(later);
    stopLater();
    expect(TerminalPart.context).toBeNull();
  });

  it("leaves a context served after it when its stop runs again", () => {
    const part: FakeWindowPartContext = new FakeWindowPartContext();
    const next: FakeWindowPartContext = new FakeWindowPartContext();
    const stop: () => void = TerminalPart.serve(part);
    stop();
    TerminalPart.serve(next);

    stop();

    expect(TerminalPart.context).toBe(next);
  });
});
