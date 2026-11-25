/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import ts from "typescript";

import type { ApiProgram } from "./api-program.ts";
import { ApiSurfaceReaderResources } from "./api-surface-reader.resources.ts";
import { ApiSurface } from "./api-surface.ts";
import { ApiValue } from "./api-value.ts";
import type { ApiVisibility } from "./api-visibility.ts";
import { ApiResources } from "./api.resources.ts";

export class ApiSurfaceReader {
  private readonly api: ApiProgram;
  private readonly hidden: number;

  public constructor(api: ApiProgram, visibility: ApiVisibility) {
    this.api = api;
    this.hidden = visibility.includesProtected ? ts.ModifierFlags.Private : ts.ModifierFlags.Private | ts.ModifierFlags.Protected;
  }

  public read(file: string): ApiSurface {
    const [, module] = this.api.readModule(file);
    const entries = new Map<string, string>();
    for (const exported of this.api.checker.getExportsOfModule(module))
      this.describe(exported.name, exported, entries);
    return new ApiSurface(entries);
  }

  private static isShown(name: string): boolean {
    return !ApiSurfaceReaderResources.hiddenMembers.has(name) && !name.startsWith(ApiResources.generatedPrefix);
  }

  private describe(path: string, exported: ts.Symbol, entries: Map<string, string>): void {
    const symbol = (exported.flags & ts.SymbolFlags.Alias) === 0 ? exported : this.api.checker.getAliasedSymbol(exported);
    const declarations = symbol.declarations ?? [];
    const flags = declarations.reduce((all, t) => all | ApiValue.readModifierFlags(t), ts.ModifierFlags.None);
    if ((flags & this.hidden) !== 0 || (symbol.flags & ts.SymbolFlags.TypeParameter) !== 0)
      return;
    const kinds = [...ApiSurfaceReaderResources.kinds].filter(([flag]) => (symbol.flags & flag) !== 0).map(([, name]) => name);
    const modifiers = [...ApiSurfaceReaderResources.modifiers].filter(([flag]) => (flags & flag) !== 0).map(([, name]) => name);
    entries.set(path, [...kinds, ...modifiers, this.describeDetail(symbol, declarations)].filter(t => t !== "").join(ApiResources.space));
    if ((symbol.flags & ApiSurfaceReaderResources.callableKinds) !== 0)
      this.describeSignatures(path, symbol, ts.SignatureKind.Call, "", entries);
    if ((symbol.flags & ts.SymbolFlags.Class) !== 0)
      this.describeSignatures(ApiSurfaceReaderResources.formatConstructorPath(path), symbol, ts.SignatureKind.Construct, (flags & ts.ModifierFlags.Abstract) === 0 ? ApiSurfaceReaderResources.newPrefix : ApiSurfaceReaderResources.abstractNewPrefix, entries);
    if ((symbol.flags & (ts.SymbolFlags.Class | ts.SymbolFlags.Enum | ts.SymbolFlags.Module)) !== 0)
      for (const [name, member] of ApiValue.listMembers(symbol.exports))
        if (ApiSurfaceReader.isShown(name))
          this.describe(ApiResources.formatExportPath(path, name), member, entries);
    if ((symbol.flags & (ts.SymbolFlags.Class | ts.SymbolFlags.Interface)) !== 0)
      for (const [name, member] of ApiValue.listMembers(symbol.members))
        if (ApiSurfaceReader.isShown(name))
          this.describe(ApiResources.formatMemberPath(path, name), member, entries);
  }

  private describeDetail(symbol: ts.Symbol, declarations: readonly ts.Declaration[]): string {
    const checker = this.api.checker;
    if ((symbol.flags & ApiSurfaceReaderResources.valueKinds) !== 0)
      return ApiSurfaceReaderResources.formatValueDetail(this.print(checker.getTypeOfSymbol(symbol)));
    if ((symbol.flags & ts.SymbolFlags.EnumMember) !== 0) {
      const member = declarations.find(ts.isEnumMember);
      return ApiSurfaceReaderResources.formatEnumDetail(Object.isUndefined(member) ? undefined : checker.getConstantValue(member));
    }
    if ((symbol.flags & ApiSurfaceReaderResources.callableKinds) !== 0)
      return "";
    const parameters = this.describeTypeParameters(declarations.flatMap(t =>
      ts.isClassDeclaration(t) || ts.isInterfaceDeclaration(t) || ts.isTypeAliasDeclaration(t) ? t.typeParameters ?? [] : []));
    const declared = checker.getDeclaredTypeOfSymbol(symbol);
    if ((symbol.flags & ts.SymbolFlags.TypeAlias) !== 0)
      return ApiSurfaceReaderResources.formatTypeAliasDetail(parameters, this.print(declared));
    const bases = declared.isClassOrInterface() ? checker.getBaseTypes(declared) : [];
    const names = bases.map(t => this.print(t));
    return [parameters, names.length === 0 ? "" : ApiSurfaceReaderResources.formatBases(names)].filter(t => t !== "").join(ApiResources.space);
  }

  private describeSignatures(path: string, symbol: ts.Symbol, kind: ts.SignatureKind, prefix: string, entries: Map<string, string>): void {
    const type = this.api.checker.getTypeOfSymbol(symbol);
    for (const [index, signature] of this.api.checker.getSignaturesOfType(type, kind).entries())
      entries.set(ApiSurfaceReaderResources.formatSignaturePath(path, index), this.describeSignature(signature, prefix));
  }

  private describeSignature(signature: ts.Signature, prefix: string): string {
    const declaration = signature.declaration;
    if (Object.isUndefined(declaration) || ts.isJSDocSignature(declaration))
      return ApiSurfaceReaderResources.formatImplicitConstructor(prefix);
    const flags = ApiValue.readModifierFlags(declaration);
    if ((flags & ts.ModifierFlags.Private) !== 0)
      return ApiSurfaceReaderResources.formatPrivateConstructor(prefix);
    const visibility = (flags & ts.ModifierFlags.Protected) === 0 ? "" : ApiSurfaceReaderResources.protectedPrefix;
    const parameters = declaration.parameters.map(t => this.describeParameter(t));
    const returned = !Object.isUndefined(declaration.type) && ts.isTypePredicateNode(declaration.type)
      ? this.api.print(declaration.type)
      : this.print(this.api.checker.getReturnTypeOfSignature(signature));
    return ApiSurfaceReaderResources.formatSignature(visibility, prefix, this.describeTypeParameters(declaration.typeParameters ?? []), parameters, returned);
  }

  private describeParameter(parameter: ts.ParameterDeclaration): string {
    const checker = this.api.checker;
    const type = Object.isUndefined(parameter.type) ? checker.getTypeAtLocation(parameter) : checker.getTypeFromTypeNode(parameter.type);
    const isOptional = !Object.isUndefined(parameter.questionToken) || !Object.isUndefined(parameter.initializer);
    return [
      Object.isUndefined(parameter.dotDotDotToken) ? "" : ApiSurfaceReaderResources.restPrefix,
      this.api.print(parameter.name),
      isOptional ? ApiSurfaceReaderResources.optionalMark : "",
      ApiSurfaceReaderResources.formatValueDetail(this.print(type))
    ].join("");
  }

  private describeTypeParameters(parameters: readonly ts.TypeParameterDeclaration[]): string {
    const descriptions = parameters.map(t => {
      const constraint = Object.isUndefined(t.constraint) ? "" : ApiSurfaceReaderResources.formatTypeParameterConstraint(this.printNodeType(t.constraint));
      const fallback = Object.isUndefined(t.default) ? "" : ApiSurfaceReaderResources.formatTypeParameterDefault(this.printNodeType(t.default));
      return `${t.name.text}${constraint}${fallback}`;
    });
    return descriptions.length === 0 ? "" : ApiSurfaceReaderResources.formatTypeParameters(descriptions);
  }

  private printNodeType(node: ts.TypeNode): string {
    return this.print(this.api.checker.getTypeFromTypeNode(node));
  }

  private print(type: ts.Type): string {
    return this.api.checker.typeToString(type, undefined, ApiSurfaceReaderResources.typeFlags);
  }
}
