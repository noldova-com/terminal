/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type IModuleLog, PermissionCenter, ToolDescriptor, ToolRegistry, ToolSchemaValidator } from "@noldova/desktop.runtime";
import { FakeModuleLog, FakeToolsContext } from "@noldova/desktop.runtime/testing";

export const TOOL_NAMES: readonly string[] = ["terminal_list", "terminal_read", "terminal_open", "terminal_run", "terminal_write", "terminal_interrupt",
  "terminal_close"];

export class RegistryToolsContext {
  public static readonly moduleId: string = "terminal";
  public readonly tools: FakeToolsContext;
  public readonly registry: ToolRegistry;
  private sessions: number = 0;

  public constructor(tools: FakeToolsContext = new FakeToolsContext(), log: IModuleLog = new FakeModuleLog(), permissions: PermissionCenter = new PermissionCenter()) {
    const module: string = RegistryToolsContext.moduleId;
    this.tools = tools;
    this.registry = new ToolRegistry(() => `session-${++this.sessions}`, new ToolSchemaValidator(), permissions);
    tools.answer("register", (descriptor, handler) => this.registry.register(module, new ToolDescriptor(descriptor, TOOL_NAMES), handler, TOOL_NAMES, log));
    tools.answer("openSession", (scope, bindings) => this.registry.openSession(scope, bindings));
    tools.answer("onSessionEnded", listener => this.registry.onSessionEnded(listener, log));
    tools.answer("stopSession", (session, reason) => this.registry.stopSession(module, session, reason));
    tools.answer("onSessionStopped", listener => this.registry.onSessionStopped(listener, log));
    tools.answer("stopAll", reason => this.registry.stopAll(reason));
    tools.answer("resumeAll", () => this.registry.resumeAll(module));
    tools.answer("onStopped", listener => this.registry.onStopped(listener, log));
    tools.answer("onResumed", listener => this.registry.onResumed(listener, log));
  }
}
