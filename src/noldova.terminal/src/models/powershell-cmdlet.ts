/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { PowerShellParameter } from "./powershell-parameter.ts";

export class PowerShellCmdlet {
  public readonly names: readonly string[];
  public readonly windowsAliases: readonly string[];
  public readonly positions: readonly string[];
  public readonly parameters: readonly PowerShellParameter[];
  public readonly dynamicParameters: readonly PowerShellParameter[];

  public constructor(names: readonly string[], windowsAliases: readonly string[], positions: readonly string[],
    parameters: readonly PowerShellParameter[], dynamicParameters: readonly PowerShellParameter[] = []) {
    this.names = names;
    this.windowsAliases = windowsAliases;
    this.positions = positions;
    this.parameters = parameters;
    this.dynamicParameters = dynamicParameters;
  }
}
