/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import ts from "typescript";

import { ApiResources } from "./api.resources.ts";

export class ApiSurfaceReaderResources {
  public static readonly typeFlags: number = ts.TypeFormatFlags.NoTruncation | ts.TypeFormatFlags.InTypeAlias;
  public static readonly kinds: ReadonlyMap<number, string> = new Map([
    [ts.SymbolFlags.Class, "class"],
    [ts.SymbolFlags.Interface, "interface"],
    [ts.SymbolFlags.TypeAlias, "type"],
    [ts.SymbolFlags.Function, "function"],
    [ts.SymbolFlags.Variable, "variable"],
    [ts.SymbolFlags.Property, "property"],
    [ts.SymbolFlags.Method, "method"],
    [ts.SymbolFlags.GetAccessor, "get"],
    [ts.SymbolFlags.SetAccessor, "set"],
    [ts.SymbolFlags.RegularEnum, "enum"],
    [ts.SymbolFlags.ConstEnum, "const enum"],
    [ts.SymbolFlags.EnumMember, "member"],
    [ts.SymbolFlags.Module, "namespace"],
    [ts.SymbolFlags.Optional, "optional"]
  ]);
  public static readonly modifiers: ReadonlyMap<number, string> = new Map([
    [ts.ModifierFlags.Protected, "protected"],
    [ts.ModifierFlags.Static, "static"],
    [ts.ModifierFlags.Abstract, "abstract"],
    [ts.ModifierFlags.Readonly, "readonly"],
    [ts.ModifierFlags.Accessor, "accessor"]
  ]);
  public static readonly hiddenMembers: ReadonlySet<string> = new Set([ApiResources.prototypeMember, ApiResources.constructorMember]);
  public static readonly valueKinds: number = ts.SymbolFlags.Variable | ts.SymbolFlags.Property | ts.SymbolFlags.Accessor;
  public static readonly callableKinds: number = ts.SymbolFlags.Function | ts.SymbolFlags.Method;
  public static readonly constructorPath: string = "constructor";
  public static readonly implicitConstructor: string = "()";
  public static readonly newPrefix: string = "new ";
  public static readonly abstractNewPrefix: string = "abstract new ";
  public static readonly protectedPrefix: string = "protected ";
  public static readonly restPrefix: string = "...";
  public static readonly optionalMark: string = "?";

  public static formatConstructorPath(path: string): string {
    return ApiResources.formatExportPath(path, ApiSurfaceReaderResources.constructorPath);
  }

  public static formatValueDetail(type: string): string {
    return `: ${type}`;
  }

  public static formatEnumDetail(value: string | number | undefined): string {
    return `= ${JSON.stringify(value)}`;
  }

  public static formatTypeAliasDetail(parameters: string, type: string): string {
    return `${parameters} = ${type}`;
  }

  public static formatBases(names: readonly string[]): string {
    return `extends ${names.join(ApiResources.listSeparator)}`;
  }

  public static formatSignaturePath(path: string, index: number): string {
    return `${path}(${index})`;
  }

  public static formatImplicitConstructor(prefix: string): string {
    return `${prefix}${ApiSurfaceReaderResources.implicitConstructor}`;
  }

  public static formatPrivateConstructor(prefix: string): string {
    return `private ${prefix}${ApiSurfaceReaderResources.implicitConstructor}`;
  }

  public static formatSignature(visibility: string, prefix: string, typeParameters: string, parameters: readonly string[], returned: string): string {
    return `${visibility}${prefix}${typeParameters}(${parameters.join(ApiResources.listSeparator)}): ${returned}`;
  }

  public static formatTypeParameterConstraint(type: string): string {
    return ` extends ${type}`;
  }

  public static formatTypeParameterDefault(type: string): string {
    return ` = ${type}`;
  }

  public static formatTypeParameters(descriptions: readonly string[]): string {
    return `<${descriptions.join(ApiResources.listSeparator)}>`;
  }
}
