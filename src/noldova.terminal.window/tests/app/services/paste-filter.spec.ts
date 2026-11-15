/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import { PasteFilter } from "../../../src/app/services/paste-filter.ts";

describe("PasteFilter", () => {
  it("removes every escape, so pasted text can't end the bracketed paste and run as typed", () => {
    expect(PasteFilter.clean("echo hi\u001b[201~\nrm -rf ~\u001b")).toBe("echo hi[201~\nrm -rf ~");
  });

  it("keeps ordinary text, new lines and tabs", () => {
    expect(PasteFilter.clean("a\tb\r\nc ü")).toBe("a\tb\r\nc ü");
  });
});
