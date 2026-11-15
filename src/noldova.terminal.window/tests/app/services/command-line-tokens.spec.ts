/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, expect, it } from "vitest";

import { CommandLineTokens } from "../../../src/app/services/command-line-tokens.ts";

function describeTokens(text: string, isPowerShell: boolean, isZsh: boolean = false): readonly string[] {
  return CommandLineTokens.read(text, isPowerShell, isZsh).map(t => `${t.kind}:${text.slice(t.start, t.end)}`);
}

describe("CommandLineTokens", () => {
  describe("in bash and zsh", () => {
    it("colors the command's name, its options, quoted strings, paths and variables, and leaves a plain argument", () => {
      expect(describeTokens("git commit -m \"fix it\" ./src ~/notes $HOME --amend", false))
        .toEqual(["Command:git", "Option:-m", "String:\"fix it\"", "Path:./src", "Path:~/notes", "Variable:$HOME", "Option:--amend"]);
    });

    it("starts a command after each pipe, list and background operator, and colors redirections with their stream numbers", () => {
      expect(describeTokens("ls -la | grep foo && echo done; cat < in.txt 2>&1 >out & wait", false)).toEqual([
        "Command:ls", "Option:-la", "Operator:|", "Command:grep", "Operator:&&", "Command:echo", "Operator:;", "Command:cat", "Operator:<",
        "Operator:2>&1", "Operator:>", "Operator:&", "Command:wait"
      ]);
      expect(describeTokens("make 2>/dev/null", false)).toEqual(["Command:make", "Operator:2>", "Path:/dev/null"]);
    });

    it("reads a variable assignment before the command and the keywords after which a command follows", () => {
      expect(describeTokens("FOO=1 make; if true; then echo $1; fi", false)).toEqual([
        "Command:make", "Operator:;", "Keyword:if", "Command:true", "Operator:;", "Keyword:then", "Command:echo", "Variable:$1", "Operator:;",
        "Keyword:fi"
      ]);
      expect(describeTokens("for name in a b; do rm \"$name\"; done", false)).toEqual([
        "Keyword:for", "Operator:;", "Keyword:do", "Command:rm", "String:\"", "Variable:$name", "String:\"", "Operator:;", "Keyword:done"
      ]);
    });

    it("keeps a single-quoted variable a string, colors a double-quoted one, and reads an escaped blank as part of the word", () => {
      expect(describeTokens("echo 'a $b' \"c ${d} e\" f\\ g", false))
        .toEqual(["Command:echo", "String:'a $b'", "String:\"c ", "Variable:${d}", "String: e\""]);
    });

    it("colors a quote still open at the line's end as a string, to the end", () => {
      expect(describeTokens("echo \"open $x", false)).toEqual(["Command:echo", "String:\"open ", "Variable:$x"]);
      expect(describeTokens("echo 'open", false)).toEqual(["Command:echo", "String:'open"]);
    });

    it("colors a comment from a word's start to the line's end, and a # inside a word as part of it", () => {
      expect(describeTokens("ls # list it", false)).toEqual(["Command:ls", "Comment:# list it"]);
      expect(describeTokens("echo a#b", false)).toEqual(["Command:echo"]);
      expect(describeTokens("ls # -a", false, true)).toEqual(["Command:ls", "Option:-a"]);
    });

    it("starts a command inside a command substitution and a subshell", () => {
      expect(describeTokens("echo $(date) (cd src && make)", false)).toEqual([
        "Command:echo", "Operator:$(", "Command:date", "Operator:)", "Operator:(", "Command:cd", "Operator:&&", "Command:make", "Operator:)"
      ]);
    });

    it("keeps an escaped quote inside a double-quoted string, and starts a substitution that follows a word without a blank", () => {
      expect(describeTokens("echo \"say \\\"hi\\\"\" a$(b)", false))
        .toEqual(["Command:echo", "String:\"say \\\"hi\\\"\"", "Operator:$(", "Command:b", "Operator:)"]);
    });

    it("reads a backslash as an escape, never as a path's separator", () => {
      expect(describeTokens("printf a\\b", false)).toEqual(["Command:printf"]);
    });

    it("measures in the line's UTF-16 units, so a character outside the basic plane takes two", () => {
      const text: string = "echo '😀' -n";

      expect(CommandLineTokens.read(text, false, false).map(t => [t.start, t.end, t.kind])).toEqual([[0, 4, "Command"], [5, 9, "String"], [10, 12, "Option"]]);
    });

    it("starts a command after each line break of a command over several lines, and ends a comment there", () => {
      expect(describeTokens("if true\nthen ls -a # list\necho \"a\nb\" $x", false)).toEqual([
        "Keyword:if", "Command:true", "Keyword:then", "Command:ls", "Option:-a", "Comment:# list", "Command:echo", "String:\"a\nb\"", "Variable:$x"
      ]);
    });

    it("joins the next line to a word or blank before an escaped line break, which starts no command", () => {
      expect(describeTokens("ls -l \\\n  -a\\\n~/x", false)).toEqual(["Command:ls", "Option:-l", "Option:-a", "Path:~/x"]);
    });

    it("reads a here-document's body as a string through its delimiter's line, and a command after it", () => {
      expect(describeTokens("cat <<EOF >out\nhello world\nEOF\nls", false))
        .toEqual(["Command:cat", "Operator:<<", "Operator:>", "String:hello world\nEOF", "Command:ls"]);
      expect(describeTokens("cat <<-'END'\n\tx\n\tEND", false)).toEqual(["Command:cat", "Operator:<<", "String:'END'", "String:\tx\n\tEND"]);
    });

    it("lets a closing line start with blanks, as the screen shows tabs, only after <<-", () => {
      expect(describeTokens("cat <<-END\n  x\n    END\nls", false)).toEqual(["Command:cat", "Operator:<<", "String:  x\n    END", "Command:ls"]);
      expect(describeTokens("cat <<END\n  END\nls", false)).toEqual(["Command:cat", "Operator:<<", "String:  END\nls"]);
    });

    it("reads a here-document still open as a string to the end, and a here-string as no here-document", () => {
      expect(describeTokens("cat <<EOF\nstill\n", false)).toEqual(["Command:cat", "Operator:<<", "String:still"]);
      expect(describeTokens("cat <<< word\nls", false)).toEqual(["Command:cat", "Operator:<<<", "Command:ls"]);
    });

    it("colors nothing on an empty or blank line", () => {
      expect(describeTokens("", false)).toEqual([]);
      expect(describeTokens(" \t ", false)).toEqual([]);
    });
  });

  describe("with a precommand modifier", () => {
    it("colors the modifier as a keyword, its options as options, and the word after them as the command", () => {
      expect(describeTokens("command -v ls; builtin cd /tmp; exec -l bash", false)).toEqual([
        "Keyword:command", "Option:-v", "Command:ls", "Operator:;", "Keyword:builtin", "Command:cd", "Path:/tmp", "Operator:;", "Keyword:exec",
        "Option:-l", "Command:bash"
      ]);
    });

    it("reads zsh's own modifiers only in zsh", () => {
      expect(describeTokens("noglob nocorrect git add a; - ls", false, true))
        .toEqual(["Keyword:noglob", "Keyword:nocorrect", "Command:git", "Operator:;", "Keyword:-", "Command:ls"]);
      expect(describeTokens("noglob ls", false)).toEqual(["Command:noglob"]);
    });

    it("reads a redirection's target after a modifier, or anywhere, as no command, and the command after it as the command", () => {
      expect(describeTokens("exec 3>log", false)).toEqual(["Keyword:exec", "Operator:3>"]);
      expect(describeTokens("exec >log 2>&1", false)).toEqual(["Keyword:exec", "Operator:>", "Operator:2>&1"]);
      expect(describeTokens("exec >/dev/null cat; >& out ls -a", false))
        .toEqual(["Keyword:exec", "Operator:>", "Path:/dev/null", "Command:cat", "Operator:;", "Operator:>&", "Command:ls", "Option:-a"]);
    });

    it("reads exec's -a value as an argument, so the word after it is the command", () => {
      expect(describeTokens("exec -a name bash -l", false)).toEqual(["Keyword:exec", "Option:-a", "Command:bash", "Option:-l"]);
      expect(describeTokens("command -a ls", false)).toEqual(["Keyword:command", "Option:-a", "Command:ls"]);
    });

    it("colors an option after the command as an option, and a modifier's word after the command as a plain argument", () => {
      expect(describeTokens("command ls -a command", false)).toEqual(["Keyword:command", "Command:ls", "Option:-a"]);
    });
  });

  describe("in zsh", () => {
    it("reads &! and &| as one operator after which a command starts, and >| and <> as redirections", () => {
      expect(describeTokens("sleep 9 &! ls &| wc >| out <> io", false, true)).toEqual([
        "Command:sleep", "Operator:&!", "Command:ls", "Operator:&|", "Command:wc", "Operator:>|", "Operator:<>"
      ]);
    });

    it("colors =name as a path, also where a command's name goes", () => {
      expect(describeTokens("ls =git; =python -V", false, true)).toEqual(["Command:ls", "Path:=git", "Operator:;", "Path:=python", "Option:-V"]);
      expect(describeTokens("[[ a == b ]]", false, true)).toEqual(["Keyword:[["]);
    });

    it("colors repeat as a keyword and the word after its count as the command", () => {
      expect(describeTokens("repeat 3 ls -a", false, true)).toEqual(["Keyword:repeat", "Command:ls", "Option:-a"]);
      expect(describeTokens("repeat $n; do ls; done", false, true))
        .toEqual(["Keyword:repeat", "Variable:$n", "Operator:;", "Keyword:do", "Command:ls", "Operator:;", "Keyword:done"]);
    });

    it("reads the words a for or foreach loops over as no command", () => {
      expect(describeTokens("foreach f (a b) echo $f; end", false, true))
        .toEqual(["Keyword:foreach", "Operator:(", "Operator:)", "Command:echo", "Variable:$f", "Operator:;", "Keyword:end"]);
      expect(describeTokens("for f (a ~/b) ls $f", false, true))
        .toEqual(["Keyword:for", "Operator:(", "Path:~/b", "Operator:)", "Command:ls", "Variable:$f"]);
      expect(describeTokens("for a b (1 2 3 4) echo $a", false, true))
        .toEqual(["Keyword:for", "Operator:(", "Operator:)", "Command:echo", "Variable:$a"]);
      expect(describeTokens("for a b in 1 2; do (ls); done", false, true))
        .toEqual(["Keyword:for", "Operator:;", "Keyword:do", "Operator:(", "Command:ls", "Operator:);", "Keyword:done"]);
    });

    it("colors a closing brace anywhere as a keyword, and always after it as a keyword a list follows", () => {
      expect(describeTokens("{ ls } always { pwd }", false, true))
        .toEqual(["Keyword:{", "Command:ls", "Keyword:}", "Keyword:always", "Keyword:{", "Command:pwd", "Keyword:}"]);
    });

    it("leaves bash's reading of the same words as it was", () => {
      expect(describeTokens("echo =git; repeat 3 ls", false)).toEqual(["Command:echo", "Operator:;", "Command:repeat"]);
      expect(describeTokens("for f (a b) ls", false)).toEqual(["Keyword:for", "Operator:(", "Command:a", "Operator:)"]);
    });
  });

  describe("in PowerShell", () => {
    it("colors cmdlets, parameters, paths with either separator, script blocks and their variables", () => {
      expect(describeTokens("Get-ChildItem -Path C:\\Users -Recurse | Where-Object { $_.Length -gt 1kb }", true)).toEqual([
        "Command:Get-ChildItem", "Option:-Path", "Path:C:\\Users", "Option:-Recurse", "Operator:|", "Command:Where-Object", "Operator:{",
        "Variable:$_", "Option:-gt", "Operator:}"
      ]);
    });

    it("reads a scoped variable and a doubled quote inside a string, and doesn't take an expression for a command", () => {
      expect(describeTokens("$env:Path = 'it''s' + \"a \"\"b\"\" $x\"", true))
        .toEqual(["Variable:$env:Path", "String:'it''s'", "String:\"a \"\"b\"\" ", "Variable:$x", "String:\""]);
    });

    it("reads keywords in any case, and starts a command in a script block", () => {
      expect(describeTokens("IF ($x) { Write-Host \"y\" } else { exit 1 }", true)).toEqual([
        "Keyword:IF", "Operator:(", "Variable:$x", "Operator:)", "Operator:{", "Command:Write-Host", "String:\"y\"", "Operator:}", "Keyword:else",
        "Operator:{", "Keyword:exit", "Operator:}"
      ]);
    });

    it("reads a parameter after a script block argument as a parameter, not as a command", () => {
      expect(describeTokens("Invoke-Command { hostname } -ComputerName a", true))
        .toEqual(["Command:Invoke-Command", "Operator:{", "Command:hostname", "Operator:}", "Option:-ComputerName"]);
    });

    it("joins the next line after a backtick at a line's end, and starts a command after a plain line break", () => {
      expect(describeTokens("Get-Item `\n  -Path a\ngci", true)).toEqual(["Command:Get-Item", "Option:-Path", "Command:gci"]);
    });

    it("reads the backtick as the escape and the call operator before a quoted program", () => {
      expect(describeTokens("Write-Output a` b", true)).toEqual(["Command:Write-Output"]);
      expect(describeTokens("& \"C:\\a b\\x.exe\" -v", true)).toEqual(["Operator:&", "String:\"C:\\a b\\x.exe\"", "Option:-v"]);
    });
  });
});
