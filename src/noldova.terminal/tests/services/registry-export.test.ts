/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import type { RegistryValue } from "../../src/models/registry-value.ts";
import { RegistryExport } from "../../src/services/registry-export.ts";

const HEADER: string = "Windows Registry Editor Version 5.00\r\n\r\n[HKEY_CURRENT_USER\\Environment]\r\n";
const INVALID: { name: string; message: string } = {
  name: "EnvironmentExportInvalidException",
  message: "reg.exe did not export the machine's and the person's variables in a form that could be read."
};

function parseValues(text: string): Readonly<Record<string, readonly [string, boolean]>> {
  return Object.fromEntries([...RegistryExport.parse(text)].map(([name, value]) => [name, [value.text, value.isExpandable] as const]));
}

describe("RegistryExport", () => {
  it("reads text values with their escapes, and expandable ones from their UTF-16 bytes, across continued lines and up to their terminator", () => {
    const values: Readonly<Record<string, readonly [string, boolean]>> = parseValues(`${HEADER}"A \\"b\\""="C:\\\\x \\"y\\""\r\n"Path"=hex(2):25,00,41,00,\\\r\n  25,00,00,00,7a,00\r\n"EMPTY"=hex(2):\r\n"ZERO"=hex(2):00,00\r\n`);

    assert.deepEqual(values, { "A \"b\"": ["C:\\x \"y\"", false], Path: ["%A%", true], EMPTY: ["", true], ZERO: ["", true] });
  });

  it("reads a text value written as bytes and one that spans lines, and a last line with no line break", () => {
    const values: Readonly<Record<string, readonly [string, boolean]>> =
      parseValues(`${HEADER}"BYTES"=hex(1):e4,00,00,00\r\n"LINES"="one\r\ntwo"\r\n"QUOTED"="end"\r\n"LAST"=hex(2):41,00`);

    assert.deepEqual(values, { BYTES: ["ä", false], LINES: ["one\r\ntwo", false], QUOTED: ["end", false], LAST: ["A", true] });
  });

  it("keeps values named like an object's own members as values", () => {
    const values: ReadonlyMap<string, RegistryValue> = RegistryExport.parse(`${HEADER}"__proto__"="kept"\r\n"constructor"=hex(2):41,00\r\n`);

    assert.deepEqual([...values].map(([name, value]) => [name, value.text, value.isExpandable]), [["__proto__", "kept", false], ["constructor", "A", true]]);
  });

  it("leaves out the default value, other kinds of value and continued lines that aren't values", () => {
    const values: Readonly<Record<string, readonly [string, boolean]>> = parseValues(`${HEADER}@="default"\r\n"NUMBER"=dword:00000001\r\n"LIST"=hex(7):41,00,00,00,\\\r\n  00,00\r\n"RAW"=hex:01\r\n"KEPT"="yes"\r\n`);

    assert.deepEqual(values, { KEPT: ["yes", false] });
  });

  it("reads only the key's own values, and none of a subkey's, which reg export writes after them", () => {
    const values: Readonly<Record<string, readonly [string, boolean]>> = parseValues(`${HEADER}"KEPT"="[yes]"\r\n"NEXT"=hex(2):41,00,\\\r\n  00,00\r\n\r\n[HKEY_CURRENT_USER\\Environment\\Sub]\r\n"SUB"="no"\r\n"KEPT"="no"\r\n`);

    assert.deepEqual(values, { KEPT: ["[yes]", false], NEXT: ["A", true] });
  });

  it("refuses a value with no equals sign, an unended quote or escape, a kind with no colon on its line, and a byte that isn't two hex digits", () => {
    for (const text of [
      `${HEADER}"NAME" "value"\r\n`,
      `${HEADER}"NAME"=dword`,
      `${HEADER}"NAME"="value\r\n`,
      `${HEADER}"NAME"="value\\`,
      `${HEADER}"NAME"=dword\r\n"OTHER"="x:y"\r\n`,
      `${HEADER}"NAME"=hex(2):4,00\r\n`
    ])
      assert.throws(() => RegistryExport.parse(text), INVALID, text);
  });
});
