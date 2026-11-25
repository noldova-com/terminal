/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import type { IWindowPartContext } from "@noldova/desktop.window";
import { ArgumentValidator } from "@noldova/terminal.protocol";

import { Resources } from "../../resources.ts";
import { StartFolderProvidedException } from "../exceptions/start-folder-provided.exception.ts";
import type { IStartFolderProvider } from "../interfaces/i-start-folder-provider.ts";

export class TerminalStartFolder {
  private static provider: IStartFolderProvider | null = null;

  public static provide(context: IWindowPartContext, folder: () => string | null): () => void {
    if (!Object.isNull(TerminalStartFolder.provider))
      throw new StartFolderProvidedException();
    const provider: IStartFolderProvider = { context, folder };
    TerminalStartFolder.provider = provider;
    return () => {
      if (TerminalStartFolder.provider === provider)
        TerminalStartFolder.provider = null;
    };
  }

  public static read(): string | null {
    const provider: IStartFolderProvider | null = TerminalStartFolder.provider;
    if (Object.isNull(provider))
      return null;
    try {
      const folder: string | null = provider.folder();
      if (!Object.isNull(folder))
        ArgumentValidator.requireAbsolutePath(Resources.startFolderName, folder);
      return folder;
    }
    catch (error) {
      provider.context.log(Resources.formatStartFolderFailed(String(error)));
      return null;
    }
  }
}
