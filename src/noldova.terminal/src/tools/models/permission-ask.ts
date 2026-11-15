/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { createHash } from "node:crypto";

import { type IPermissionDetail, type IPermissionRequest, PermissionOption, ToolRisk } from "@noldova/desktop.runtime";

import { Resources } from "../../resources.ts";

export class PermissionAsk {
  public static readonly alwaysOptions: readonly PermissionOption[] = [PermissionOption.AllowOnce, PermissionOption.AllowAlways, PermissionOption.Deny];
  public static readonly onceOptions: readonly PermissionOption[] = [PermissionOption.AllowOnce, PermissionOption.Deny];

  public readonly toolName: string;
  public readonly request: IPermissionRequest;

  public constructor(toolName: string, action: string, title: string, risk: ToolRisk, details: readonly IPermissionDetail[], subject: string,
    options: readonly PermissionOption[] = PermissionAsk.alwaysOptions) {
    this.toolName = toolName;
    this.request = {
      action: Resources.formatPermissionAskAction(action),
      subject,
      title,
      details,
      risk,
      isAsking: risk !== ToolRisk.Low,
      options
    };
  }

  public static listSubject(parts: readonly (string | null)[]): string {
    return JSON.stringify(parts);
  }

  public static hashSubject(parts: readonly (string | null)[]): string {
    return `${Resources.subjectHashPrefix}${createHash(Resources.subjectHashAlgorithm).update(JSON.stringify(parts)).digest(Resources.hexEncoding)}`;
  }
}
