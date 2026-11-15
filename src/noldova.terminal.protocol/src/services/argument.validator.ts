/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException, ArgumentOutOfRangeException } from "@noldova/context.exceptions";

import { ArgumentProblem } from "../models/argument-problem.ts";
import { Resources } from "../resources.ts";

export class ArgumentValidator {
  public static throwIfProblem(problem: ArgumentProblem | null): void {
    if (problem !== null)
      throw new ArgumentException(problem.message, problem.parameterName);
  }

  public static requireIdentifier(name: string, value: string): void {
    ArgumentValidator.throwIfProblem(ArgumentValidator.findIdentifierProblem(name, value));
  }

  public static findIdentifierProblem(name: string, value: string): ArgumentProblem | null {
    return ArgumentValidator.findNonBlankProblem(name, value, Resources.maximumIdentifierLength);
  }

  public static requireNonBlank(name: string, value: string, maximumLength: number): void {
    ArgumentValidator.throwIfProblem(ArgumentValidator.findNonBlankProblem(name, value, maximumLength));
  }

  public static findNonBlankProblem(name: string, value: string, maximumLength: number): ArgumentProblem | null {
    const problem: ArgumentProblem | null = ArgumentValidator.findMaximumLengthProblem(name, value, maximumLength);
    if (problem !== null)
      return problem;
    return value.trim().length === 0 ? ArgumentValidator.createProblem(name, t => Resources.formatBlankString(t)) : null;
  }

  public static requireAbsolutePath(name: string, value: string): void {
    ArgumentValidator.throwIfProblem(ArgumentValidator.findAbsolutePathProblem(name, value));
  }

  public static findAbsolutePathProblem(name: string, value: string): ArgumentProblem | null {
    const problem: ArgumentProblem | null = ArgumentValidator.findNonBlankProblem(name, value, Resources.maximumPathLength);
    if (problem !== null)
      return problem;
    return Resources.absolutePathPattern.test(value) ? null : ArgumentValidator.createProblem(name, t => Resources.formatNotAbsolutePath(t));
  }

  public static requireMaximumLength(name: string, value: string, maximumLength: number): void {
    ArgumentValidator.throwIfProblem(ArgumentValidator.findMaximumLengthProblem(name, value, maximumLength));
  }

  public static findMaximumLengthProblem(name: string, value: string, maximumLength: number): ArgumentProblem | null {
    return value.length > maximumLength ? ArgumentValidator.createProblem(name, t => Resources.formatTooLong(t, maximumLength)) : null;
  }

  public static requireEnvironment(name: string, value: Readonly<Record<string, string>>): void {
    ArgumentValidator.throwIfProblem(ArgumentValidator.findEnvironmentProblem(name, value));
  }

  public static findEnvironmentProblem(name: string, value: Readonly<Record<string, string>>): ArgumentProblem | null {
    const names: readonly string[] = Object.keys(value);
    if (names.length > Resources.maximumVariables)
      return ArgumentValidator.createProblem(name, t => Resources.formatTooManyVariables(t, Resources.maximumVariables));
    const seen: Map<string, string> = new Map<string, string>();
    let length: number = 0;
    for (const variable of names) {
      if (variable.length > Resources.maximumVariableNameLength || !Resources.variableNamePattern.test(variable))
        return ArgumentValidator.createProblem(name, t => Resources.formatNotVariableName(t));
      const path: string = Resources.formatFieldPath(name, variable);
      const upper: string = variable.toUpperCase();
      if (Resources.refusedVariables.includes(upper) || upper.startsWith(Resources.refusedVariablePrefix))
        return ArgumentValidator.createProblem(path, t => Resources.formatRefusedVariable(t));
      const other: string | undefined = seen.get(upper);
      if (other !== undefined)
        return ArgumentValidator.createProblem(path, t => Resources.formatSameVariable(t, Resources.formatFieldPath(name, other)));
      seen.set(upper, variable);
      const text: unknown = value[variable];
      if (typeof text !== "string")
        return ArgumentValidator.createProblem(path, t => Resources.formatNotString(t));
      const tooLong: ArgumentProblem | null = ArgumentValidator.findMaximumLengthProblem(path, text, Resources.maximumVariableValueLength);
      if (tooLong !== null)
        return tooLong;
      if (text.includes(Resources.nullCharacter))
        return ArgumentValidator.createProblem(path, t => Resources.formatNullCharacter(t));
      length += variable.length + text.length;
    }
    return length > Resources.maximumEnvironmentLength
      ? ArgumentValidator.createProblem(name, t => Resources.formatEnvironmentTooLong(t, Resources.maximumEnvironmentLength))
      : null;
  }

  public static requireCommandNames(name: string, value: readonly string[]): void {
    ArgumentValidator.throwIfProblem(ArgumentValidator.findCommandNamesProblem(name, value));
  }

  public static findCommandNamesProblem(name: string, value: readonly string[]): ArgumentProblem | null {
    if (value.length > Resources.maximumLookedUpCommands)
      return ArgumentValidator.createProblem(name, t => Resources.formatTooManyNames(t, Resources.maximumLookedUpCommands));
    for (const item of value) {
      const problem: ArgumentProblem | null = ArgumentValidator.findNonBlankProblem(name, item, Resources.maximumSuggestionLength);
      if (problem !== null)
        return problem;
    }
    return null;
  }

  public static requireCommand(name: string, value: string): void {
    ArgumentValidator.throwIfProblem(ArgumentValidator.findCommandProblem(name, value));
  }

  public static findCommandProblem(name: string, value: string): ArgumentProblem | null {
    const problem: ArgumentProblem | null = ArgumentValidator.findNonBlankProblem(name, value, Resources.maximumCommandLength);
    if (problem !== null)
      return problem;
    return Resources.controlCharacters.test(value) ? ArgumentValidator.createProblem(name, t => Resources.formatControlCharacter(t)) : null;
  }

  public static requireScript(name: string, value: string): void {
    ArgumentValidator.throwIfProblem(ArgumentValidator.findScriptProblem(name, value));
  }

  public static findScriptProblem(name: string, value: string): ArgumentProblem | null {
    const problem: ArgumentProblem | null = ArgumentValidator.findNonBlankProblem(name, value, Resources.maximumCommandLength);
    if (problem !== null)
      return problem;
    if (Resources.scriptControlCharacters.test(value))
      return ArgumentValidator.createProblem(name, t => Resources.formatScriptControlCharacter(t));
    const hidden: RegExpExecArray | null = Resources.scriptHiddenCharacters.exec(value.replace(Resources.scriptEmoji, ""));
    return hidden === null ? null : ArgumentValidator.createProblem(name, t => Resources.formatScriptHiddenCharacter(t, hidden[0]));
  }

  public static requireIntegerInRange(name: string, value: number, minimum: number, maximum: number): void {
    const problem: ArgumentProblem | null = ArgumentValidator.findIntegerInRangeProblem(name, value, minimum, maximum);
    if (problem !== null)
      throw new ArgumentOutOfRangeException(problem.parameterName, value, problem.message);
  }

  public static findIntegerInRangeProblem(name: string, value: number, minimum: number, maximum: number): ArgumentProblem | null {
    return Number.isSafeInteger(value) && value >= minimum && value <= maximum
      ? null
      : ArgumentValidator.createProblem(name, t => Resources.formatNotIntegerInRange(t, minimum, maximum));
  }

  public static requireOneOf(name: string, value: string, values: readonly string[]): void {
    ArgumentValidator.throwIfProblem(ArgumentValidator.findOneOfProblem(name, value, values));
  }

  public static findOneOfProblem(name: string, value: string, values: readonly string[]): ArgumentProblem | null {
    return values.includes(value) ? null : ArgumentValidator.createProblem(name, t => Resources.formatNotOneOf(t, values));
  }

  public static requireEachOneOf(name: string, value: readonly string[], values: readonly string[]): void {
    ArgumentValidator.throwIfProblem(ArgumentValidator.findEachOneOfProblem(name, value, values));
  }

  public static findEachOneOfProblem(name: string, value: readonly string[], values: readonly string[]): ArgumentProblem | null {
    for (const [index, item] of value.entries()) {
      if (!values.includes(item))
        return ArgumentValidator.findOneOfProblem(Resources.formatFieldPath(name, String(index)), item, values);
    }
    return null;
  }

  private static createProblem(name: string, format: (subject: string) => string): ArgumentProblem {
    return new ArgumentProblem(name, format(name), format(Resources.valueSubject));
  }
}
