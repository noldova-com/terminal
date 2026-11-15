/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IAgentCommand } from "../interfaces/i-agent-command.ts";
import type { IOutputSource } from "../interfaces/i-output-source.ts";

export class ReadCursor {
  public readonly source: IOutputSource;
  public readonly command: IAgentCommand | null;
  public readonly offset: number;

  private constructor(source: IOutputSource, command: IAgentCommand | null, offset: number) {
    this.source = source;
    this.command = command;
    this.offset = offset;
  }

  public static forCommand(command: IAgentCommand, offset: number): ReadCursor {
    return new ReadCursor(command, command, offset);
  }

  public static forTerminal(terminal: IOutputSource, offset: number): ReadCursor {
    return new ReadCursor(terminal, null, offset);
  }

  public advancedTo(offset: number): ReadCursor {
    return new ReadCursor(this.source, this.command, offset);
  }
}
