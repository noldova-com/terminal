/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TerminalShellKind } from "@noldova/terminal.protocol";
import { Terminal } from "@xterm/xterm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { CommandTokenKind } from "../../../src/app/enums/command-token-kind.ts";
import { CommandColors } from "../../../src/app/models/command-colors.ts";
import { CommandColoring } from "../../../src/app/services/command-coloring.ts";
import { DrawnWait } from "../../fixtures/drawn-wait.fixture.ts";

const ASK_WAIT_MS: number = DrawnWait.milliseconds;
const COLORS: Readonly<Record<CommandTokenKind, string>> = {
  Command: "#ff0000",
  NotFound: "#ff8000",
  Keyword: "#800000",
  Option: "#00ff00",
  String: "#0000ff",
  Path: "#ff00ff",
  Variable: "#00ffff",
  Operator: "#ffff00",
  Comment: "#008000"
};

const LETTERS: Readonly<Record<string, string>> = {
  "rgb(255, 0, 0)": "C",
  "rgb(255, 128, 0)": "N",
  "rgb(128, 0, 0)": "K",
  "rgb(0, 255, 0)": "O",
  "rgb(0, 0, 255)": "S",
  "rgb(255, 0, 255)": "P",
  "rgb(0, 255, 255)": "V",
  "rgb(255, 255, 0)": "X",
  "rgb(0, 128, 0)": "#",
  "rgb(16, 16, 16)": ".",
  "rgb(205, 49, 49)": "r"
};

describe("CommandColoring", () => {
  let host: HTMLElement;
  let terminal: Terminal;
  let coloring: CommandColoring;
  const logs: string[] = [];

  const writeAsync = (data: string): Promise<void> => new Promise<void>(resolve => terminal.write(data, resolve));

  const drawnOf = (row: number): string => {
    const line: Element | undefined = [...host.querySelectorAll(".xterm-rows > div")][row];
    const screen: DOMRect = host.querySelector(".xterm-screen")?.getBoundingClientRect() ?? new DOMRect();
    const cellWidth: number = screen.width / terminal.cols;
    const letters: string[] = [];
    let end: number = 0;
    for (const node of line?.childNodes ?? []) {
      const range: Range = document.createRange();
      range.selectNodeContents(node);
      const box: DOMRect = range.getBoundingClientRect();
      const first: number = Math.round((box.left - screen.left) / cellWidth);
      const count: number = Math.round(box.width / cellWidth);
      letters.length = Math.max(letters.length, first + count);
      letters.fill(LETTERS[getComputedStyle(node instanceof Element ? node : line ?? host).color] ?? "?", first, first + count);
      const text: string = node.textContent ?? "";
      if (text.trim().length > 0)
        end = Math.max(end, first + count - (text.length - text.trimEnd().length));
    }
    return Array.from({ length: end }, (_, index) => letters[index] ?? ".").join("");
  };

  function open(columns: number): void {
    terminal = new Terminal({ cols: columns, rows: 5, fontSize: 16, fontFamily: "monospace", allowProposedApi: true,
      theme: { foreground: "#101010", red: "#cd3131" } });
    terminal.open(host);
    coloring = new CommandColoring(terminal, t => logs.push(t));
    coloring.setColors(new CommandColors(COLORS));
    coloring.enable(true);
  }

  async function promptAsync(prompt: string = "$ "): Promise<void> {
    await writeAsync(prompt);
    coloring.startInput();
  }

  beforeEach(() => {
    host = document.createElement("div");
    document.body.append(host);
    logs.length = 0;
  });

  afterEach(() => {
    coloring.dispose();
    terminal.dispose();
    host.remove();
  });

  it("colors each part of a bash command in its color from the line's start, and leaves the prompt and a plain argument", async () => {
    open(60);
    await promptAsync();

    await writeAsync("git commit -m \"fix\" ./src $HOME | wc # done");

    await vi.waitFor(() => expect(drawnOf(0)).toBe("..CCC........OO.SSSSS.PPPPP.VVVVV.X.CC.######"), { timeout: DrawnWait.milliseconds });
  });

  it("colors keywords, and reads the line by PowerShell's rules once the shell is PowerShell", async () => {
    open(60);
    coloring.setShell(TerminalShellKind.PowerShell);
    await promptAsync("PS> ");

    await writeAsync("if ($x) { gci $env:Path }");

    await vi.waitFor(() => expect(drawnOf(0)).toBe("....KK.XVVX.X.CCC.VVVVVVVVV.X"), { timeout: DrawnWait.milliseconds });
  });

  it("follows the line as it changes, and takes the colors off cells the shell erased", async () => {
    open(40);
    await promptAsync();
    await writeAsync("ls -la");
    await vi.waitFor(() => expect(drawnOf(0)).toBe("..CC.OOO"), { timeout: DrawnWait.milliseconds });

    await writeAsync("\b\b\b\u001b[K| wc");

    await vi.waitFor(() => expect(drawnOf(0)).toBe("..CC.X.CC"), { timeout: DrawnWait.milliseconds });
  });

  it("keeps the colors the shell drew itself, and colors only its cells in the default text color", async () => {
    open(40);
    await promptAsync();

    await writeAsync("\u001b[31mls\u001b[0m -la");

    await vi.waitFor(() => expect(drawnOf(0)).toBe("..rr.OOO"), { timeout: DrawnWait.milliseconds });
  });

  it("colors a part on the rows the line wraps to, a cell the shell skipped as a blank, and a wide character's two cells as one", async () => {
    open(10);
    await promptAsync();

    await writeAsync("echo \"aaaa bbbb\" -n");
    await vi.waitFor(() => expect([drawnOf(0), drawnOf(1), drawnOf(2)]).toEqual(["..CCCC.SSS", "SSSSSSSS.O", "O"]), { timeout: DrawnWait.milliseconds });
    await writeAsync("\r\n$ ");
    coloring.startInput();
    await writeAsync("ls\u001b[C中 -a");

    await vi.waitFor(() => expect(drawnOf(3)).toBe("..CC....OO"), { timeout: DrawnWait.milliseconds });
  });

  it("reads a command over several lines after each continuation prompt the shell marked, so a quote open at a line's end goes on", async () => {
    open(40);
    coloring.continueInput();
    await promptAsync();
    coloring.continueInput();
    await writeAsync("echo 'a\r\n> ");

    coloring.continueInput();
    coloring.continueInput();
    await writeAsync("b' | wc");

    await vi.waitFor(() => expect([drawnOf(0), drawnOf(1)]).toEqual(["..CCCC.SS", "..SS.X.CC"]), { timeout: DrawnWait.milliseconds });
    coloring.endInput();
    await writeAsync("\r\n> ");
    coloring.continueInput();
    await writeAsync("ls");
    await vi.waitFor(() => expect(drawnOf(2)).toBe("...."), { timeout: DrawnWait.milliseconds });
  });

  it("reads a line's last row to its last cell that isn't blank, so a \\ there joins the next line", async () => {
    open(40);
    await promptAsync();
    await writeAsync("ls \\\r\n> ");
    coloring.continueInput();

    await writeAsync("-a");

    await vi.waitFor(() => expect([drawnOf(0), drawnOf(1)]).toEqual(["..CC..", "..OO"]), { timeout: DrawnWait.milliseconds });
  });

  it("ends a here-document at its closing word on the screen, so the command after it is read as one", async () => {
    open(40);
    await promptAsync();
    await writeAsync("cat <<EOF &&\r\n> ");
    coloring.continueInput();
    await writeAsync("x\r\n> ");
    coloring.continueInput();
    await writeAsync("EOF\r\n> ");
    coloring.continueInput();

    await writeAsync("echo done");

    await vi.waitFor(() => expect([drawnOf(1), drawnOf(2), drawnOf(3)]).toEqual(["..S", "..SSS", "..CCCC....."]), { timeout: DrawnWait.milliseconds });
  });

  it("colors nothing past the right prompt the shell marked on the line's row", async () => {
    open(40);
    coloring.startInputAt(0, 2, 30);
    await writeAsync("$ \u001b[31G~/src\u001b[3G");

    await writeAsync("ls ~/x");

    await vi.waitFor(() => expect(drawnOf(0)).toBe("..CC.PPP" + ".".repeat(22) + "....."), { timeout: DrawnWait.milliseconds });
  });

  it("reads a right prompt marked on the line's row, but none marked before a line starts or on another row", async () => {
    open(40);
    coloring.markRightPrompt();
    await promptAsync();
    await writeAsync("\u001b[31G");
    coloring.markRightPrompt();
    await writeAsync("~/src\u001b[3G\r\n");
    coloring.markRightPrompt();

    await writeAsync("\u001b[A\u001b[3Gls ~/x");

    await vi.waitFor(() => expect(drawnOf(0)).toBe("..CC.PPP" + ".".repeat(22) + "....."), { timeout: DrawnWait.milliseconds });
  });

  it("keeps a line's colors once the shell leaves it, colors nothing until the next line starts, and drops every color when turned off", async () => {
    open(40);
    await promptAsync();
    await writeAsync("ls -a");
    await vi.waitFor(() => expect(drawnOf(0)).toBe("..CC.OO"), { timeout: DrawnWait.milliseconds });
    coloring.endInput();

    await writeAsync("\r\nls -x\r\n$ ");
    coloring.startInput();
    await writeAsync("cd");

    await vi.waitFor(() => expect([drawnOf(0), drawnOf(1), drawnOf(2)]).toEqual(["..CC.OO", ".....", "..CC"]), { timeout: DrawnWait.milliseconds });
    coloring.enable(false);
    await vi.waitFor(() => expect([drawnOf(0), drawnOf(2)]).toEqual([".......", "...."]), { timeout: DrawnWait.milliseconds });
  });

  it("takes a kept line's colors off once other text is written over its cells, so that text draws plain", async () => {
    open(40);
    await promptAsync();
    await writeAsync("ls -a ~/x");
    await vi.waitFor(() => expect(drawnOf(0)).toBe("..CC.OO.PPP"), { timeout: DrawnWait.milliseconds });
    coloring.endInput();

    await writeAsync("\r\n\u001b[Hnotes.txt here");

    await vi.waitFor(() => expect(drawnOf(0)).toBe(".............."), { timeout: DrawnWait.milliseconds });
  });

  it("reads a # in a zsh line as a plain character, since an interactive zsh reads no comments", async () => {
    open(40);
    coloring.setShell(TerminalShellKind.Zsh);
    await promptAsync();

    await writeAsync("echo a # -b");

    await vi.waitFor(() => expect(drawnOf(0)).toBe("..CCCC.....OO"), { timeout: DrawnWait.milliseconds });
  });

  it("reads a zsh line by zsh's rules, with its modifiers, =name and &!", async () => {
    open(40);
    coloring.setShell(TerminalShellKind.Zsh);
    await promptAsync();

    await writeAsync("noglob =ls -a &! ls");

    await vi.waitFor(() => expect(drawnOf(0)).toBe("..KKKKKK.PPP.OO.XX.CC"), { timeout: DrawnWait.milliseconds });
  });

  it("recolors the lines it keeps when the colors change, and leaves a part without a color in the cell's own", async () => {
    open(40);
    await promptAsync();
    await writeAsync("ls -a");
    coloring.endInput();
    await writeAsync("\r\n$ ");
    coloring.startInput();
    await writeAsync("cd ~");

    coloring.setColors(new CommandColors({ Command: COLORS.Keyword, Option: COLORS.Comment }));

    await vi.waitFor(() => expect([drawnOf(0), drawnOf(1)]).toEqual(["..KK.##", "..KK.."]), { timeout: DrawnWait.milliseconds });
  });

  it("draws nothing on rows the terminal cleared, when the colors change", async () => {
    open(40);
    await promptAsync();
    await writeAsync("ls -a");
    coloring.endInput();
    await writeAsync("\r\n$ ");
    coloring.startInput();
    await writeAsync("cd");
    await vi.waitFor(() => expect(drawnOf(1)).toBe("..CC"), { timeout: DrawnWait.milliseconds });

    terminal.clear();
    coloring.setColors(new CommandColors({ ...COLORS, Command: COLORS.Keyword }));

    await vi.waitFor(() => expect(drawnOf(0)).toBe("...."), { timeout: DrawnWait.milliseconds });
  });

  describe("for a command the shell would find nowhere", () => {
    let asked: (readonly string[])[];
    let answers: ((names: readonly string[]) => void)[];

    function findLater(): void {
      coloring.setShell(TerminalShellKind.Bash);
      coloring.setFinder(async names => {
        asked.push(names);
        return new Promise<readonly string[]>(resolve => answers.push(resolve));
      });
    }

    beforeEach(() => {
      asked = [];
      answers = [];
    });

    it("colors it once the runtime answers, asking one request at a time and about each name once a prompt", async () => {
      open(40);
      findLater();
      await promptAsync();
      await writeAsync("gti");
      await vi.waitFor(() => expect(asked).toEqual([["gti"]]), { timeout: ASK_WAIT_MS });

      await writeAsync(" | ls");
      await vi.waitFor(() => expect(drawnOf(0)).toBe("..CCC.X.CC"), { timeout: DrawnWait.milliseconds });
      expect(asked).toEqual([["gti"]]);
      answers[0]?.(["gti"]);
      await vi.waitFor(() => expect(asked).toEqual([["gti"], ["ls"]]), { timeout: ASK_WAIT_MS });
      answers[1]?.([]);
      await vi.waitFor(() => expect(drawnOf(0)).toBe("..NNN.X.CC"), { timeout: DrawnWait.milliseconds });
      await writeAsync(" | gti");

      await vi.waitFor(() => expect(drawnOf(0)).toBe("..NNN.X.CC.X.NNN"), { timeout: DrawnWait.milliseconds });
      expect(asked).toEqual([["gti"], ["ls"]]);
    });

    it("asks about a PowerShell line's commands, leaving its variables, and colors the one the runtime answers", async () => {
      open(40);
      coloring.setShell(TerminalShellKind.PowerShell);
      coloring.setFinder(async names => {
        asked.push(names);
        return names.filter(t => t === "gti");
      });
      await promptAsync();

      await writeAsync("Get-ChildItem $x | gti");

      await vi.waitFor(() => expect(drawnOf(0)).toBe("..CCCCCCCCCCCCC.VV.X.NNN"), { timeout: DrawnWait.milliseconds });
      expect(asked).toEqual([["Get-ChildItem", "gti"]]);
    });

    it("asks again at the next prompt, and leaves the next line as it is for an answer that comes after it starts", async () => {
      open(40);
      findLater();
      await promptAsync();
      await writeAsync("gti");
      await vi.waitFor(() => expect(asked).toEqual([["gti"]]), { timeout: ASK_WAIT_MS });
      coloring.endInput();
      await writeAsync("\r\n");
      await promptAsync();
      await writeAsync("gti");

      answers[0]?.(["gti"]);
      await vi.waitFor(() => expect(asked).toEqual([["gti"], ["gti"]]), { timeout: ASK_WAIT_MS });
      await vi.waitFor(() => expect([drawnOf(0), drawnOf(1)]).toEqual(["..CCC", "..CCC"]), { timeout: DrawnWait.milliseconds });
      answers[1]?.(["gti"]);

      await vi.waitFor(() => expect([drawnOf(0), drawnOf(1)]).toEqual(["..CCC", "..NNN"]), { timeout: DrawnWait.milliseconds });
    });

    it("asks nothing about a quoted or expanded name, nor for a shell other than bash, zsh or PowerShell, and nothing more once a request fails", async () => {
      open(40);
      coloring.setShell(TerminalShellKind.Zsh);
      coloring.setFinder(async names => {
        asked.push(names);
        throw new Error("The runtime has no terminal.findCommands.");
      });
      await promptAsync();
      await writeAsync("\"gti\" | $x | gti");
      await vi.waitFor(() => expect(asked).toEqual([["gti"]]), { timeout: ASK_WAIT_MS });
      coloring.endInput();
      await writeAsync("\r\n");
      await promptAsync();
      await writeAsync("gtx");
      await vi.waitFor(() => expect(drawnOf(1)).toBe("..CCC"), { timeout: DrawnWait.milliseconds });
      coloring.setShell(TerminalShellKind.Fish);
      coloring.setFinder(async names => {
        asked.push(names);
        return names;
      });
      await writeAsync(" | gty");

      await vi.waitFor(() => expect(drawnOf(1)).toBe("..CCC.X.CCC"), { timeout: DrawnWait.milliseconds });
      expect(asked).toEqual([["gti"]]);
      expect(logs).toEqual(["The terminal could not look up typed commands, so it colors them without telling whether they exist: The runtime has no terminal.findCommands."]);
    });
  });

  it("asks with a finder set while an earlier one's request is under way, and keeps it once that request fails", async () => {
    const asked: (readonly string[])[] = [];
    let fail: (error: Error) => void = () => undefined;
    open(40);
    coloring.setShell(TerminalShellKind.Bash);
    coloring.setFinder(async names => {
      asked.push(names);
      return new Promise<readonly string[]>((_resolve, reject) => {
        fail = reject;
      });
    });
    await promptAsync();
    await writeAsync("gti");
    await vi.waitFor(() => expect(asked).toEqual([["gti"]]), { timeout: ASK_WAIT_MS });
    coloring.setFinder(async names => {
      asked.push(names);
      return names;
    });
    await vi.waitFor(() => expect(drawnOf(0)).toBe("..NNN"), { timeout: DrawnWait.milliseconds });

    fail(new Error("The terminal closed."));
    await writeAsync(" | gtx");

    await vi.waitFor(() => expect(drawnOf(0)).toBe("..NNN.X.NNN"), { timeout: DrawnWait.milliseconds });
    expect(asked).toEqual([["gti"], ["gti"], ["gtx"]]);
    expect(logs).toEqual(["The terminal could not look up typed commands, so it colors them without telling whether they exist: The terminal closed."]);
  });

  it("asks again once resumed after a request failed, and not before", async () => {
    const asked: (readonly string[])[] = [];
    open(40);
    coloring.setShell(TerminalShellKind.Bash);
    coloring.setFinder(async names => {
      asked.push(names);
      if (asked.length === 1)
        throw new Error("The terminal closed.");
      return names;
    });
    await promptAsync();
    await writeAsync("gti");
    await vi.waitFor(() => expect(logs).toHaveLength(1), { timeout: ASK_WAIT_MS });
    await writeAsync(" | gtx");
    await vi.waitFor(() => expect(drawnOf(0)).toBe("..CCC.X.CCC"), { timeout: DrawnWait.milliseconds });
    expect(asked).toEqual([["gti"]]);

    coloring.resumeFinder();

    await vi.waitFor(() => expect(drawnOf(0)).toBe("..NNN.X.NNN"), { timeout: DrawnWait.milliseconds });
    expect(asked).toEqual([["gti"], ["gti", "gtx"]]);
  });

  it("keeps the finder when a request under way at a resume fails", async () => {
    const asked: (readonly string[])[] = [];
    let fail: (error: Error) => void = () => undefined;
    open(40);
    coloring.setShell(TerminalShellKind.Bash);
    coloring.setFinder(async names => {
      asked.push(names);
      if (asked.length > 1)
        return names;
      return new Promise<readonly string[]>((_resolve, reject) => {
        fail = reject;
      });
    });
    await promptAsync();
    await writeAsync("gti");
    await vi.waitFor(() => expect(asked).toEqual([["gti"]]), { timeout: ASK_WAIT_MS });
    coloring.resumeFinder();
    await writeAsync(" | gtx");

    fail(new Error("The terminal closed."));

    await vi.waitFor(() => expect(drawnOf(0)).toBe("..NNN.X.NNN"), { timeout: DrawnWait.milliseconds });
    expect(asked).toEqual([["gti"], ["gti", "gtx"]]);
  });

  it("asks nothing once resumed with no finder set", async () => {
    open(40);
    coloring.setShell(TerminalShellKind.Bash);

    coloring.resumeFinder();
    await promptAsync();
    await writeAsync("gti");

    await vi.waitFor(() => expect(drawnOf(0)).toBe("..CCC"), { timeout: DrawnWait.milliseconds });
    expect(logs).toEqual([]);
  });

  it("colors nothing on the alternate screen, where no line starts", async () => {
    open(40);
    await writeAsync("\u001b[?1049h");
    coloring.startInput();

    await writeAsync("ls -a");

    await vi.waitFor(() => expect(drawnOf(0)).toBe("....."), { timeout: DrawnWait.milliseconds });
  });
});
