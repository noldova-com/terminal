/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class OpenTerminalResources {
  public static readonly runtimePackage: string = "@noldova/terminal/runtime";
  public static readonly ptyPackage: string = "node-pty";
  public static readonly moduleId: string = "terminal";
  public static readonly command: string = "echo installed-package-$((6*7))";
  public static readonly marker: string = "installed-package-42";
  public static readonly promptEndMark: string = "\u001b]6973;B;";
  public static readonly outputEvent: string = "terminal.output";
  public static readonly dataField: string = "data";
  public static readonly shellsField: string = "shells";
  public static readonly defaultField: string = "isDefault";
  public static readonly idField: string = "id";
  public static readonly sessionField: string = "sessionId";
  public static readonly nameField: string = "name";
  public static readonly shellsMethod: string = "terminal.shells";
  public static readonly openMethod: string = "terminal.open";
  public static readonly inputMethod: string = "terminal.input";
  public static readonly closeMethod: string = "terminal.close";
  public static readonly connection: number = 1;
  public static readonly window: number = 1;
  public static readonly columns: number = 100;
  public static readonly rows: number = 30;
  public static readonly storedLimit: number = 104_857_600;
  public static readonly echoTimeout: number = 30_000;
  public static readonly requestTimeout: number = 30_000;
  public static readonly dataPrefix: string = "noldova-terminal-installed-";
  public static readonly insertStatement: string = "INSERT";
  public static readonly deleteStatement: string = "DELETE";
  public static readonly statementSeparator: string = " ";
  public static readonly enter: string = "\r";
  public static readonly outputTail: number = 1_000;
  public static readonly noShell: string = "The installed runtime part found no shell.";
  public static readonly noTerminal: string = "The installed runtime part opened no terminal.";

  public static formatResolved(name: string, file: string): string {
    return `${name}: ${file}`;
  }

  public static formatMethodMissing(name: string): string {
    return `The installed runtime part did not register ${name}.`;
  }

  public static formatEchoMissing(output: string): string {
    return `The shell did not echo ${OpenTerminalResources.marker} and draw its next prompt within ${OpenTerminalResources.echoTimeout} ms. Output: ${JSON.stringify(output.slice(-OpenTerminalResources.outputTail))}`;
  }

  public static formatOpened(shellId: string): string {
    return `Opened ${shellId} from the installed package and read its echo.`;
  }

  public static formatLogged(messages: readonly string[]): string {
    return `The runtime part logged: ${messages.join(" | ")}`;
  }

  public static formatStatements(statements: readonly string[]): string {
    return `The runtime part did not keep the terminal and forget it on close; it ran: ${statements.join(", ")}`;
  }

  public static formatTools(names: readonly string[], active: number): string {
    return `The runtime part registered the tools ${names.join(", ")} and left ${active} of them registered after it deactivated.`;
  }
}
