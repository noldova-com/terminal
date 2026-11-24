/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import ts from "typescript";

import { Resources } from "../resources.ts";
import { ApiNotModuleException } from "./api-not-module.exception.ts";
import { ApiProgramUnreadableException } from "./api-program-unreadable.exception.ts";
import { ApiResources } from "./api.resources.ts";

export class ApiProgram {
  private readonly printer: ts.Printer = ts.createPrinter({ removeComments: true });

  public readonly program: ts.Program;
  public readonly checker: ts.TypeChecker;

  private constructor(program: ts.Program) {
    this.program = program;
    this.checker = program.getTypeChecker();
  }

  public static open(projectFile: string): ApiProgram {
    const parsed = ApiProgram.readProject(projectFile);
    return new ApiProgram(ts.createProgram({ rootNames: parsed.fileNames, options: parsed.options }));
  }

  public static readProject(projectFile: string): ts.ParsedCommandLine {
    const problems: string[] = [];
    const parsed = ts.getParsedCommandLineOfConfigFile(projectFile, undefined, {
      ...ts.sys,
      onUnRecoverableConfigFileDiagnostic: t => {
        problems.push(ApiProgram.describe(t));
      }
    });
    problems.push(...(parsed?.errors ?? []).map(t => ApiProgram.describe(t)));
    if (Object.isUndefined(parsed) || problems.length > 0)
      throw new ApiProgramUnreadableException(projectFile, problems);
    return parsed;
  }

  public static describe(diagnostic: ts.Diagnostic): string {
    return ApiResources.formatDiagnostic(diagnostic.code, ts.flattenDiagnosticMessageText(diagnostic.messageText, Resources.lineEnd));
  }

  public readModule(file: string): readonly [ts.SourceFile, ts.Symbol] {
    const source = this.program.getSourceFile(file);
    const module = Object.isUndefined(source) ? undefined : this.checker.getSymbolAtLocation(source);
    if (Object.isUndefined(source) || Object.isUndefined(module))
      throw new ApiNotModuleException(file);
    return [source, module];
  }

  public print(node: ts.Node): string {
    return this.printer.printNode(ts.EmitHint.Unspecified, node, node.getSourceFile());
  }
}
