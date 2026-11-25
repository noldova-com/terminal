/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import { type IPermissionDetail, PermissionDetailKind } from "@noldova/desktop.runtime";

import { Resources } from "../../resources.ts";
import type { AgentTerminalAccess } from "../models/agent-terminal-access.ts";
import { TerminalTextEscaper } from "./terminal-text-escaper.ts";

export class PermissionDetails {
  public static text(label: string, value: string): IPermissionDetail {
    return { label, kind: PermissionDetailKind.Text, value };
  }

  public static code(label: string, value: string): IPermissionDetail {
    return { label, kind: PermissionDetailKind.Code, value };
  }

  public static yesNo(label: string, value: boolean): IPermissionDetail {
    return PermissionDetails.text(label, value ? Resources.yes : Resources.no);
  }

  public static forTerminal(access: AgentTerminalAccess): IPermissionDetail[] {
    return [
      PermissionDetails.text(Resources.terminalLabel, TerminalTextEscaper.escapeUnseen(access.terminal.title)),
      PermissionDetails.code(Resources.terminalIdLabel, access.terminal.id),
      PermissionDetails.yesNo(Resources.sharedLabel, access.isShared)
    ];
  }

  public static forShell(access: AgentTerminalAccess): IPermissionDetail[] {
    return [PermissionDetails.text(Resources.shellLabel, access.terminal.shellId), PermissionDetails.code(Resources.shellPathLabel, access.terminal.shellPath)];
  }

  public static forFolder(folder: string | null, isInsideWorkingFolder: boolean): IPermissionDetail[] {
    return [
      Object.isNull(folder)
        ? PermissionDetails.text(Resources.folderLabel, Resources.unknownFolder)
        : PermissionDetails.code(Resources.folderLabel, TerminalTextEscaper.escapeUnseen(folder)),
      PermissionDetails.yesNo(Resources.insideWorkingFolderLabel, isInsideWorkingFolder)
    ];
  }

  public static forExplanation(explanation: string | null): IPermissionDetail[] {
    return Object.isNull(explanation) ? [] : [{ label: Resources.explanationLabel, kind: PermissionDetailKind.AgentText, value: explanation }];
  }
}
