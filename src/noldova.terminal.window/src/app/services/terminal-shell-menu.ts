/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonValue } from "@noldova/context.json";
import { SettingOption } from "@noldova/desktop.protocol";
import { MenuRowContribution, type IWindowPartContext } from "@noldova/desktop.window";
import { TerminalNames, TerminalShells, type TerminalShell } from "@noldova/terminal.protocol";

import { Resources } from "../../resources.ts";

export class TerminalShellMenu {
  private readonly context: IWindowPartContext;
  private shells: readonly TerminalShell[] | null = null;

  public constructor(context: IWindowPartContext) {
    this.context = context;
  }

  public async loadAsync(): Promise<void> {
    try {
      this.shells = TerminalShells.fromJson(await this.context.requestAsync(TerminalNames.shellsMethod, null)).shells;
    }
    catch (error) {
      this.shells = [];
      this.context.log(Resources.formatShellsFailed(error));
    }
    this.context.refreshSettingOptions(Resources.defaultShellSetting);
  }

  public listRows(): readonly MenuRowContribution[] {
    const chosen: TerminalShell | undefined = this.findDefault();
    return (this.shells ?? []).map(t => t === chosen
      ? new MenuRowContribution(Resources.newCommand, {}, Resources.formatDefaultShellRow(t.name),
        Resources.shellKindIcons[t.kind])
      : new MenuRowContribution(Resources.newWithShellCommand, { [Resources.shellIdArgument]: t.id }, t.name,
        Resources.shellKindIcons[t.kind]));
  }

  public listOptions(): readonly SettingOption[] | null {
    if (this.shells === null)
      return null;
    const systemDefault: TerminalShell | undefined = this.shells.find(t => t.isDefault);
    return [
      new SettingOption("", systemDefault === undefined ? Resources.systemDefaultShell : Resources.formatSystemDefaultShell(systemDefault.name)),
      ...this.shells.map(t => new SettingOption(t.id, t.name))
    ];
  }

  private findDefault(): TerminalShell | undefined {
    const chosen: JsonValue | undefined = this.context.readSetting(Resources.defaultShellSetting);
    return this.shells?.find(t => t.id === chosen) ?? this.shells?.find(t => t.isDefault);
  }
}
