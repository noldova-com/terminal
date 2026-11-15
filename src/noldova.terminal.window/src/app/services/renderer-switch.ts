/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { WebglAddon } from "@xterm/addon-webgl";
import type { Terminal } from "@xterm/xterm";

import { Resources } from "../../resources.ts";

export class RendererSwitch {
  private readonly terminal: Terminal;
  private readonly log: (message: string) => void;
  private webgl: WebglAddon | null = null;
  private hasFailed: boolean = false;

  public constructor(terminal: Terminal, log: (message: string) => void) {
    this.terminal = terminal;
    this.log = log;
  }

  public get isWebgl(): boolean {
    return this.webgl !== null;
  }

  public show(): void {
    if (this.webgl !== null || this.hasFailed)
      return;
    try {
      const addon: WebglAddon = new WebglAddon();
      addon.onContextLoss(() => this.fallBack(Resources.contextLost));
      this.terminal.loadAddon(addon);
      this.webgl = addon;
    }
    catch (error) {
      this.fallBack(Resources.formatWebglFailed(error));
    }
  }

  public hide(): void {
    this.webgl?.dispose();
    this.webgl = null;
  }

  private fallBack(message: string): void {
    this.hasFailed = true;
    this.hide();
    this.log(message);
  }
}
