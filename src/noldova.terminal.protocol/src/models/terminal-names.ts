/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../resources.ts";

export class TerminalNames {
  public static readonly shellsMethod: string = Resources.shellsMethod;
  public static readonly openMethod: string = Resources.openMethod;
  public static readonly closeMethod: string = Resources.closeMethod;
  public static readonly restartMethod: string = Resources.restartMethod;
  public static readonly sessionsMethod: string = Resources.sessionsMethod;
  public static readonly attachMethod: string = Resources.attachMethod;
  public static readonly inputMethod: string = Resources.inputMethod;
  public static readonly resizeMethod: string = Resources.resizeMethod;
  public static readonly ackMethod: string = Resources.ackMethod;
  public static readonly visibilityMethod: string = Resources.visibilityMethod;
  public static readonly detachMethod: string = Resources.detachMethod;
  public static readonly linesMethod: string = Resources.linesMethod;
  public static readonly restoreMethod: string = Resources.restoreMethod;
  public static readonly closeOwnerMethod: string = Resources.closeOwnerMethod;
  public static readonly launchMethod: string = Resources.launchMethod;
  public static readonly runMethod: string = Resources.runMethod;
  public static readonly runOutputMethod: string = Resources.runOutputMethod;
  public static readonly windowStartedMethod: string = Resources.windowStartedMethod;
  public static readonly showOwnerMethod: string = Resources.showOwnerMethod;
  public static readonly renameMethod: string = Resources.renameMethod;
  public static readonly completeMethod: string = Resources.completeMethod;
  public static readonly findCommandsMethod: string = Resources.findCommandsMethod;
  public static readonly outputEvent: string = Resources.outputEvent;
  public static readonly exitedEvent: string = Resources.exitedEvent;
  public static readonly restartedEvent: string = Resources.restartedEvent;
  public static readonly titleChangedEvent: string = Resources.titleChangedEvent;
  public static readonly cwdChangedEvent: string = Resources.cwdChangedEvent;
  public static readonly detachedEvent: string = Resources.detachedEvent;
  public static readonly closedEvent: string = Resources.closedEvent;
  public static readonly openedEvent: string = Resources.openedEvent;
  public static readonly runOpenedEvent: string = Resources.runOpenedEvent;
  public static readonly launchCommandEndedEvent: string = Resources.launchCommandEndedEvent;
  public static readonly runEndedEvent: string = Resources.runEndedEvent;
  public static readonly renamedEvent: string = Resources.renamedEvent;
  public static readonly commandAddedEvent: string = Resources.commandAddedEvent;
  public static readonly methods: readonly string[] = [
    TerminalNames.shellsMethod,
    TerminalNames.openMethod,
    TerminalNames.closeMethod,
    TerminalNames.restartMethod,
    TerminalNames.sessionsMethod,
    TerminalNames.attachMethod,
    TerminalNames.inputMethod,
    TerminalNames.resizeMethod,
    TerminalNames.ackMethod,
    TerminalNames.visibilityMethod,
    TerminalNames.detachMethod,
    TerminalNames.linesMethod,
    TerminalNames.restoreMethod,
    TerminalNames.closeOwnerMethod,
    TerminalNames.launchMethod,
    TerminalNames.runMethod,
    TerminalNames.runOutputMethod,
    TerminalNames.windowStartedMethod,
    TerminalNames.showOwnerMethod,
    TerminalNames.renameMethod,
    TerminalNames.completeMethod,
    TerminalNames.findCommandsMethod
  ];
  public static readonly events: readonly string[] = [
    TerminalNames.outputEvent,
    TerminalNames.exitedEvent,
    TerminalNames.restartedEvent,
    TerminalNames.titleChangedEvent,
    TerminalNames.cwdChangedEvent,
    TerminalNames.detachedEvent,
    TerminalNames.closedEvent,
    TerminalNames.openedEvent,
    TerminalNames.launchCommandEndedEvent,
    TerminalNames.runOpenedEvent,
    TerminalNames.runEndedEvent,
    TerminalNames.renamedEvent,
    TerminalNames.commandAddedEvent
  ];
}
