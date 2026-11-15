/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ShellClients } from "@noldova/desktop.protocol";
import type { RequestContext } from "@noldova/desktop.runtime";

export class RequestClient {
  public readonly connection: number;
  public readonly window: number | null;
  public readonly isApp: boolean;
  public readonly page: number | null;

  public constructor(connection: number, window: number | null, isApp: boolean, page: number | null = null) {
    this.connection = connection;
    this.window = window;
    this.isApp = isApp;
    this.page = page;
  }

  public static fromContext(context: RequestContext): RequestClient {
    return new RequestClient(context.connection, context.window, context.client === ShellClients.mainProcess, context.page);
  }
}
