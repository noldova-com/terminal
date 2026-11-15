/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { EventChannel } from "@noldova/desktop.runtime";
import type { JsonValue } from "@noldova/context.json";

import type { HostedTerminal } from "../models/hosted-terminal.ts";
import type { RequestClient } from "../models/request-client.ts";

export class TerminalAudience {
  private readonly windows: Map<number, Set<number>> = new Map<number, Set<number>>();
  private readonly apps: Set<number> = new Set<number>();
  private readonly shownOwners: Map<number, Map<number, string>> = new Map<number, Map<number, string>>();
  private readonly hiddenWindows: Map<number, Set<number>> = new Map<number, Set<number>>();

  public see(client: RequestClient): void {
    let windows: Set<number> | undefined = this.windows.get(client.connection);
    if (windows === undefined) {
      windows = new Set<number>();
      this.windows.set(client.connection, windows);
      if (client.isApp)
        this.apps.add(client.connection);
    }
    if (client.window !== null)
      windows.add(client.window);
  }

  public forget(connection: number, window: number | null): boolean {
    if (window !== null) {
      this.windows.get(connection)?.delete(window);
      this.shownOwners.get(connection)?.delete(window);
      this.hiddenWindows.get(connection)?.delete(window);
      return false;
    }
    this.windows.delete(connection);
    this.shownOwners.delete(connection);
    this.hiddenWindows.delete(connection);
    return this.apps.delete(connection);
  }

  public show(client: RequestClient, owner: string | null, isHidden: boolean): void {
    if (client.window === null)
      return;
    let hidden: Set<number> | undefined = this.hiddenWindows.get(client.connection);
    if (hidden === undefined) {
      hidden = new Set<number>();
      this.hiddenWindows.set(client.connection, hidden);
    }
    if (isHidden)
      hidden.add(client.window);
    else
      hidden.delete(client.window);
    let owners: Map<number, string> | undefined = this.shownOwners.get(client.connection);
    if (owners === undefined) {
      owners = new Map<number, string>();
      this.shownOwners.set(client.connection, owners);
    }
    if (owner === null)
      owners.delete(client.window);
    else
      owners.set(client.window, owner);
  }

  public shows(terminal: Pick<HostedTerminal, "isReachedBy" | "owner">): boolean {
    for (const [connection, owners] of this.shownOwners)
      if (terminal.isReachedBy(connection, this.apps.has(connection)) && [...owners.values()].some(t => t === terminal.owner))
        return true;
    return false;
  }

  public isOpen(client: RequestClient): boolean {
    return client.window === null ? this.windows.has(client.connection) : this.windows.get(client.connection)?.has(client.window) === true;
  }

  public isHidden(client: RequestClient): boolean {
    return client.window !== null && this.hiddenWindows.get(client.connection)?.has(client.window) === true;
  }

  public isApp(connection: number): boolean {
    return this.apps.has(connection);
  }

  public publish(channel: EventChannel, terminal: Pick<HostedTerminal, "isReachedBy">, payload: JsonValue): void {
    for (const [connection, windows] of this.windows) {
      if (!terminal.isReachedBy(connection, this.apps.has(connection)))
        continue;
      if (windows.size === 0)
        channel.publishTo(connection, null, payload);
      for (const window of windows)
        channel.publishTo(connection, window, payload);
    }
  }
}
