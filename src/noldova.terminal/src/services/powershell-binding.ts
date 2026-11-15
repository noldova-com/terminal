/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { PowerShellCmdlet } from "../models/powershell-cmdlet.ts";
import type { PowerShellParameter } from "../models/powershell-parameter.ts";
import { Resources } from "../resources.ts";

export class PowerShellBinding {
  private readonly isWindows: boolean;

  public constructor(isWindows: boolean) {
    this.isWindows = isWindows;
  }

  public bindsWildcardPath(words: readonly string[]): boolean {
    const [command, ...rest] = words.map(t => t.toLowerCase());
    if (command === undefined)
      return false;
    const cmdlet: PowerShellCmdlet | undefined = Resources.powerShellPathCmdlets
      .find(t => t.names.includes(command) || (this.isWindows && t.windowsAliases.includes(command)));
    if (cmdlet === undefined)
      return false;
    const parameters: readonly PowerShellParameter[] = [...cmdlet.parameters, ...Resources.powerShellCommonParameters];
    const named: string[] = [];
    let pending: PowerShellParameter | null = null;
    let positional: number = 0;
    let ended: boolean = false;
    for (const word of rest) {
      if (pending !== null) {
        named.push(pending.slot);
        pending = null;
        continue;
      }
      if (ended || !word.startsWith(Resources.powerShellParameterPrefix)) {
        positional++;
        continue;
      }
      if (word === Resources.powerShellEndOfParameters) {
        ended = true;
        continue;
      }
      const separator: number = word.indexOf(Resources.powerShellParameterValueSeparator);
      const name: string = word.slice(Resources.powerShellParameterPrefix.length, separator < 0 ? word.length : separator);
      const fixed: readonly PowerShellParameter[] = this.matches(parameters, name);
      const found: readonly PowerShellParameter[] = fixed.length > 0 ? fixed : this.matches(cmdlet.dynamicParameters, name);
      const parameter: PowerShellParameter | undefined = found.length === 1 ? found.at(0) : undefined;
      if (parameter === undefined)
        return false;
      if (separator >= 0 || parameter.isSwitch)
        named.push(parameter.slot);
      else
        pending = parameter;
    }
    if (pending !== null)
      return pending.name === Resources.powerShellPathParameter;
    return cmdlet.positions.filter(t => !named.includes(t)).at(positional) === Resources.powerShellPathParameter;
  }

  private matches(parameters: readonly PowerShellParameter[], name: string): readonly PowerShellParameter[] {
    const exact: PowerShellParameter | undefined = parameters.find(t => t.name === name || t.aliases.includes(name));
    return exact !== undefined ? [exact] : parameters.filter(t => [t.name, ...t.aliases].some(n => n.startsWith(name)));
  }
}
