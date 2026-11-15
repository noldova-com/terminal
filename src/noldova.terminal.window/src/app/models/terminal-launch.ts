/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { TerminalShellKind } from "@noldova/terminal.protocol";

export class TerminalLaunch {
  public readonly folder: string | null;
  public readonly environment: Readonly<Record<string, string>>;
  public readonly notice: string | null;
  public readonly title: string | null;
  public readonly command: string | null;
  public readonly opensTab: boolean;
  public readonly minimumRows: number | null;
  public readonly shellKinds: readonly TerminalShellKind[];

  public constructor(folder: string | null, environment: Readonly<Record<string, string>> = {}, notice: string | null = null,
    title: string | null = null, command: string | null = null, opensTab: boolean = true, minimumRows: number | null = null,
    shellKinds: readonly TerminalShellKind[] = []) {
    this.folder = folder;
    this.environment = environment;
    this.notice = notice;
    this.title = title;
    this.command = command;
    this.opensTab = opensTab;
    this.minimumRows = minimumRows;
    this.shellKinds = [...shellKinds];
  }
}
