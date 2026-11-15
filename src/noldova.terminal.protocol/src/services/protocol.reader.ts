/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException, ExceptionOptions } from "@noldova/context.exceptions";
import { JsonException, JsonReader } from "@noldova/context.json";

import { Resources } from "../resources.ts";

export class ProtocolReader {
  private readonly reader: JsonReader;

  private constructor(reader: JsonReader) {
    this.reader = reader;
  }

  public get path(): string {
    return this.reader.path;
  }

  public static fromValue(value: unknown, path: string = Resources.rootPath): ProtocolReader {
    return new ProtocolReader(JsonReader.fromValue(value, path));
  }

  public create<T>(factory: () => T): T {
    try {
      return factory();
    }
    catch (error) {
      if (!(error instanceof ArgumentException))
        throw error;
      const path: string = error.parameterName === undefined ? this.path : this.fieldPath(error.parameterName);
      throw new JsonException(error.message, path, new ExceptionOptions(error));
    }
  }

  public allowOnly(names: readonly string[]): void {
    for (const name of Object.keys(this.reader.toJson())) {
      if (!names.includes(name))
        throw new JsonException(Resources.unknownField, this.fieldPath(name));
    }
  }

  public readString(name: string, maximumLength: number): string {
    return this.requireMaximumLength(name, this.reader.readString(name), maximumLength);
  }

  public readNonBlankString(name: string, maximumLength: number): string {
    return this.requireMaximumLength(name, this.reader.readNonBlankString(name), maximumLength);
  }

  public readNullableNonBlankString(name: string, maximumLength: number): string | null {
    return this.reader.readNullableString(name) === null ? null : this.readNonBlankString(name, maximumLength);
  }

  public readBoolean(name: string): boolean {
    return this.reader.readBoolean(name);
  }

  public readInteger(name: string, minimum: number, maximum: number): number {
    return this.requireRange(name, this.reader.readInteger(name), minimum, maximum);
  }

  public readNullableInteger(name: string, minimum: number, maximum: number): number | null {
    const value: number | null = this.reader.readNullableInteger(name);
    return value === null ? null : this.requireRange(name, value, minimum, maximum);
  }

  public readOptionalString(name: string, maximumLength: number): string | undefined {
    return this.reader.hasField(name) ? this.readString(name, maximumLength) : undefined;
  }

  public readOptionalNullableString(name: string, maximumLength: number): string | null {
    if (!this.reader.hasField(name))
      return null;
    const value: string | null = this.reader.readNullableString(name);
    return value === null ? null : this.requireMaximumLength(name, value, maximumLength);
  }

  public readOptionalInteger(name: string, minimum: number, maximum: number): number | undefined {
    return this.reader.hasField(name) ? this.readInteger(name, minimum, maximum) : undefined;
  }

  public readOptionalBoolean(name: string): boolean | undefined {
    return this.reader.hasField(name) ? this.readBoolean(name) : undefined;
  }

  public readOneOf<T extends string>(name: string, values: readonly T[]): T {
    return this.reader.readOneOf(name, values);
  }

  public readOneOfArray<T extends string>(name: string, values: readonly T[]): readonly T[] {
    return this.reader.readStringArray(name).map((item, index) => {
      const match: T | undefined = values.find(t => t === item);
      if (match === undefined)
        throw new JsonException(Resources.formatExpectedOneOf(values), this.itemPath(name, index));
      return match;
    });
  }

  public readNonBlankStringArray(name: string, maximumLength: number, maximumCount: number): readonly string[] {
    const items: readonly string[] = this.reader.readStringArray(name);
    if (items.length > maximumCount)
      throw new JsonException(Resources.formatMoreItemsThan(maximumCount), this.fieldPath(name));
    items.forEach((item, index) => {
      if (item.length > maximumLength)
        throw new JsonException(Resources.formatLongerThan(maximumLength), this.itemPath(name, index));
      if (item.trim().length === 0)
        throw new JsonException(Resources.blankItem, this.itemPath(name, index));
    });
    return items;
  }

  public readOptionalOneOfArray<T extends string>(name: string, values: readonly T[]): readonly T[] {
    return this.reader.hasField(name) ? this.readOneOfArray(name, values) : [];
  }

  public readObject(name: string): ProtocolReader {
    return new ProtocolReader(this.reader.readObject(name));
  }

  public readStringRecord(name: string, maximumLength: number): Readonly<Record<string, string>> {
    const record: ProtocolReader = this.readObject(name);
    return Object.fromEntries(Object.keys(record.reader.toJson()).map(t => [t, record.readString(t, maximumLength)]));
  }

  public readNullableObject(name: string): ProtocolReader | null {
    return this.reader.readNullableObject(name) === null ? null : this.readObject(name);
  }

  public readObjectArray(name: string): readonly ProtocolReader[] {
    return this.reader.readObjectArray(name).map(t => new ProtocolReader(t));
  }

  private requireMaximumLength(name: string, value: string, maximumLength: number): string {
    if (value.length > maximumLength)
      throw new JsonException(Resources.formatLongerThan(maximumLength), this.fieldPath(name));
    return value;
  }

  private requireRange(name: string, value: number, minimum: number, maximum: number): number {
    if (!Number.isSafeInteger(value) || value < minimum || value > maximum)
      throw new JsonException(Resources.formatOutsideRange(minimum, maximum), this.fieldPath(name));
    return value;
  }

  private fieldPath(name: string): string {
    return Resources.formatFieldPath(this.path, name);
  }

  private itemPath(name: string, index: number): string {
    return Resources.formatFieldPath(this.fieldPath(name), String(index));
  }
}
