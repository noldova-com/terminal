/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Exception, ExceptionOptions } from "@noldova/context.exceptions";
import type { IRuntimePart, IRuntimePartContext, Migration } from "@noldova/desktop.runtime";

/**
 * The system requirements the runtime part checks before it starts: a Windows build, or the glibc version on Linux.
 *
 * @example
 * ```ts
 * import { SystemRequirement } from "@noldova/terminal/runtime";
 *
 * console.log(SystemRequirement.Glibc);
 * ```
 */
export declare const SystemRequirement: {
  /** Windows build 17763 or later. */
  readonly WindowsBuild: "WindowsBuild";
  /** glibc 2.28 or later, on Linux. */
  readonly Glibc: "Glibc";
};

/**
 * A system requirement: `WindowsBuild` or `Glibc`.
 */
export type SystemRequirement = (typeof SystemRequirement)[keyof typeof SystemRequirement];

/**
 * The base of every exception the terminal module's runtime part throws.
 *
 * @example
 * ```ts
 * import { SystemRequirement, TerminalException, UnsupportedSystemException } from "@noldova/terminal/runtime";
 *
 * console.log(new UnsupportedSystemException(SystemRequirement.Glibc, "2.27") instanceof TerminalException);
 * ```
 */
export declare class TerminalException extends Exception {
  /**
   * @param message The exception's message.
   * @param options Its cause, if any.
   */
  public constructor(message: string, options?: ExceptionOptions);
}

/**
 * The runtime part refused to start on a system below its minimums: Windows below build 17763, or Linux below glibc 2.28.
 *
 * @example
 * ```ts
 * import { SystemRequirement, UnsupportedSystemException } from "@noldova/terminal/runtime";
 *
 * console.log(new UnsupportedSystemException(SystemRequirement.WindowsBuild, "17134").message);
 * ```
 */
export declare class UnsupportedSystemException extends TerminalException {
  /** The requirement the system is below. */
  public readonly requirement: SystemRequirement;

  /** What the system has: its Windows build or its glibc version. */
  public readonly found: string;

  /**
   * @param requirement The requirement the system is below.
   * @param found What the system has.
   */
  public constructor(requirement: SystemRequirement, found: string);
}

/**
 * The terminal module's runtime part, which Noldova Desktop's runtime loads and activates.
 *
 * @remarks
 * Each terminal runs a shell in a pseudo-terminal and keeps its screen and scrollback in a headless mirror,
 * which answers the shell's terminal queries while no window is attached.
 * Output goes to windows in numbered batches, and the shell pauses while an attached, visible pane is too far behind.
 */
export declare class RuntimePart implements IRuntimePart {
  /**
   * The module database's migrations: a table of the person's terminals, which
   * the next run opens again through `terminal.restore`.
   */
  public readonly migrations: readonly Migration[];

  /**
   * Registers the `terminal.*` methods, declares the `terminal.*` events and publishes the `terminal.owners` service,
   * which a module's runtime part reads with `getService("terminal.owners", RuntimeTerminalOwners)`, through `@noldova/terminal.protocol`'s contract.
   *
   * @param context The runtime's context for this part; its log receives shells that do not end in time.
   * @returns A promise that resolves once every method is registered.
   * @throws {@link UnsupportedSystemException} Through the promise, after writing the reason to the context's log, on Windows below build 17763 or
   * Linux below glibc 2.28.
   * @example
   * ```ts
   * import type { IRuntimePartContext } from "@noldova/desktop.runtime";
   * import { RuntimePart } from "@noldova/terminal/runtime";
   *
   * export async function startTerminalAsync(context: IRuntimePartContext): Promise<RuntimePart> {
   *   const part = new RuntimePart();
   *   await part.activateAsync(context);
   *   return part;
   * }
   * ```
   */
  public activateAsync(context: IRuntimePartContext): Promise<void>;

  /**
   * Ends every terminal's shell and forgets every terminal.
   *
   * @returns A promise that resolves once every shell has ended or its grace has run out; it never rejects.
   * Calling it again, or before {@link RuntimePart.activateAsync}, does nothing.
   * @example
   * ```ts
   * import type { IRuntimePartContext } from "@noldova/desktop.runtime";
   * import { RuntimePart } from "@noldova/terminal/runtime";
   *
   * export async function runTerminalOnceAsync(context: IRuntimePartContext): Promise<void> {
   *   const part = new RuntimePart();
   *   await part.activateAsync(context);
   *   await part.deactivateAsync();
   * }
   * ```
   */
  public deactivateAsync(): Promise<void>;
}
