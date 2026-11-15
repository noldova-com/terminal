/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { EnvironmentExportInvalidException } from "../exceptions/environment-export-invalid.exception.ts";
import { RegistryValue } from "../models/registry-value.ts";
import { Resources } from "../resources.ts";

export class RegistryExport {
  private readonly text: string;
  private index: number = 0;

  private constructor(text: string) {
    this.text = text;
  }

  public static parse(text: string): ReadonlyMap<string, RegistryValue> {
    return new RegistryExport(text).readValues();
  }

  private readValues(): ReadonlyMap<string, RegistryValue> {
    const values: Map<string, RegistryValue> = new Map<string, RegistryValue>();
    let isInKey: boolean = false;
    while (this.index < this.text.length) {
      if (this.text[this.index] === Resources.registryExportKeyStart) {
        if (isInKey)
          break;
        isInKey = true;
      }
      if (this.text[this.index] !== Resources.registryExportQuote) {
        this.readData();
        continue;
      }
      const name: string = this.readQuoted();
      if (this.text[this.index] !== Resources.registryExportEquals)
        throw new EnvironmentExportInvalidException();
      this.index++;
      if (this.text[this.index] === Resources.registryExportQuote) {
        const value: string = this.readQuoted();
        this.readData();
        if (name !== "")
          values.set(name, new RegistryValue(value, false));
        continue;
      }
      const typeEnd: number = this.text.indexOf(Resources.registryExportTypeEnd, this.index);
      const lineEnd: number = this.text.indexOf(Resources.lineFeed, this.index);
      if (typeEnd === -1 || (lineEnd !== -1 && typeEnd > lineEnd))
        throw new EnvironmentExportInvalidException();
      const type: string = this.text.slice(this.index, typeEnd);
      this.index = typeEnd + 1;
      const data: string = this.readData();
      if (name !== "" && (type === Resources.registryExportExpandableType || type === Resources.registryExportTextType))
        values.set(name, new RegistryValue(RegistryExport.decode(data), type === Resources.registryExportExpandableType));
    }
    return values;
  }

  private readQuoted(): string {
    let value: string = "";
    this.index++;
    for (;;) {
      const character: string | undefined = this.text[this.index];
      if (character === undefined)
        throw new EnvironmentExportInvalidException();
      if (character === Resources.registryExportQuote) {
        this.index++;
        return value;
      }
      if (character === Resources.registryExportEscape) {
        const escaped: string | undefined = this.text[this.index + 1];
        if (escaped === undefined)
          throw new EnvironmentExportInvalidException();
        value += escaped;
        this.index += 2;
      }
      else {
        value += character;
        this.index++;
      }
    }
  }

  private readData(): string {
    let data: string = "";
    let isFirst: boolean = true;
    for (;;) {
      const end: number = this.text.indexOf(Resources.lineFeed, this.index);
      let line: string = this.text.slice(this.index, end === -1 ? this.text.length : end);
      this.index = end === -1 ? this.text.length : end + 1;
      if (line.endsWith(Resources.carriageReturn))
        line = line.slice(0, -1);
      if (!isFirst)
        line = line.trimStart();
      isFirst = false;
      if (!line.endsWith(Resources.registryExportEscape) || end === -1)
        return data + line;
      data += line.slice(0, -1);
    }
  }

  private static decode(data: string): string {
    const bytes: number[] = data.trim() === "" ? [] : data.split(Resources.registryExportByteSeparator).map(t => {
      const digits: string = t.trim();
      if (!Resources.registryExportByteDigits.test(digits))
        throw new EnvironmentExportInvalidException();
      return Number.parseInt(digits, Resources.hexadecimalRadix);
    });
    const text: string = new TextDecoder(Resources.registryExportUtf16Label).decode(Uint8Array.from(bytes));
    const end: number = text.indexOf(Resources.registryExportTerminator);
    return end === -1 ? text : text.slice(0, end);
  }
}
