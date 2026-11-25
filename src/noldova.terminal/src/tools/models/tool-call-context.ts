/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import { isAbsolute, relative, sep } from "node:path";

import { ArgumentException } from "@noldova/context.exceptions";
import type { JsonValue } from "@noldova/context.json";
import type { IPermissionRequest, PermissionOutcome, ToolCall } from "@noldova/desktop.runtime";
import { ArgumentValidator, ProtocolReader, Resources as ProtocolResources } from "@noldova/terminal.protocol";

import { Resources } from "../../resources.ts";

export class ToolCallContext {
  public readonly agentSessionId: string;
  public readonly workingFolder: string;
  public readonly boundTerminalIds: readonly string[];
  public readonly owner: string | null;
  private readonly call: ToolCall;

  public constructor(call: ToolCall) {
    const reader: ProtocolReader = ProtocolReader.fromValue(call.bindings);
    const folder: string = reader.readNonBlankString(Resources.folderBinding, ProtocolResources.maximumPathLength);
    if (!isAbsolute(folder))
      throw new ArgumentException(Resources.formatNotAbsolutePath(ProtocolResources.valueSubject), Resources.folderBinding);
    const shared: JsonValue | undefined = new Map<string, JsonValue>(Object.entries(call.bindings)).get(Resources.sharedBinding);
    if (!Object.isUndefined(shared) && !Array.isArray(shared))
      throw new ArgumentException(Resources.formatBindingNotList(ProtocolResources.valueSubject), Resources.sharedBinding);
    const boundTerminalIds: string[] = [];
    for (const terminalId of shared ?? []) {
      if (!Object.isString(terminalId))
        throw new ArgumentException(Resources.formatBindingNotList(ProtocolResources.valueSubject), Resources.sharedBinding);
      ArgumentValidator.requireIdentifier(Resources.sharedBinding, terminalId);
      boundTerminalIds.push(terminalId);
    }
    const owner: string | undefined = reader.readOptionalString(Resources.ownerBinding, ProtocolResources.maximumOwnerLength);
    if (!Object.isUndefined(owner))
      ArgumentValidator.requireNonBlank(Resources.ownerBinding, owner, ProtocolResources.maximumOwnerLength);

    this.call = call;
    this.agentSessionId = call.session;
    this.workingFolder = folder;
    this.boundTerminalIds = boundTerminalIds;
    this.owner = owner ?? null;
  }

  public get signal(): AbortSignal {
    return this.call.signal;
  }

  public get hasMarkedSending(): boolean {
    return this.call.hasMarkedSending;
  }

  public markSending(): void {
    this.call.markSending();
  }

  public requestPermissionAsync(request: IPermissionRequest): Promise<PermissionOutcome> {
    return this.call.requestPermissionAsync(request);
  }

  public isBound(terminalId: string): boolean {
    return this.boundTerminalIds.includes(terminalId);
  }

  public isInsideWorkingFolder(folder: string): boolean {
    const path: string = relative(this.workingFolder, folder);
    return path === "" || (path !== Resources.toolCallContextParentFolder && !path.startsWith(`${Resources.toolCallContextParentFolder}${sep}`) && !isAbsolute(path));
  }
}
