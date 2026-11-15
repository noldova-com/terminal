/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import type { ShellLine } from "../../src/models/shell-line.ts";
import { ShellWords } from "../../src/services/shell-words.ts";

function read(text: string, isPowerShell: boolean = false): [readonly string[], number, string, string | null] {
  const line: ShellLine = ShellWords.read(text, isPowerShell);
  return [line.words, line.start, line.value, line.quote];
}

describe("ShellWords", () => {
  describe("reading bash and zsh", () => {
    it("splits words at spaces and tabs, and starts the cursor's word at its first character", () => {
      assert.deepEqual(read("git  checkout\tma"), [["git", "checkout"], 14, "ma", null]);
    });

    it("starts an empty word at the cursor after a space, and on an empty line", () => {
      assert.deepEqual(read("ls "), [["ls"], 3, "", null]);
      assert.deepEqual(read(""), [[], 0, "", null]);
    });

    it("reads quotes and the backslash away, and keeps an open quote", () => {
      assert.deepEqual(read("cat 'My Docs'/a\\ b \"x"), [["cat", "My Docs/a b"], 19, "x", "\""]);
      assert.deepEqual(read("cd \"My Docs\"/a b"), [["cd", "My Docs/a"], 15, "b", null]);
      assert.deepEqual(read("cd 'it''s"), [["cd"], 3, "its", "'"]);
      assert.deepEqual(read("cd \\'a"), [["cd"], 3, "'a", null]);
    });

    it("keeps a backslash in double quotes but before a quote, a backslash, a dollar or a backtick, and inside single quotes", () => {
      assert.deepEqual(read("echo \"a\\b\\\"c\\\\d\\$e"), [["echo"], 5, "a\\b\"c\\d$e", "\""]);
      assert.deepEqual(read("echo 'a\\b"), [["echo"], 5, "a\\b", "'"]);
    });

    it("tells whether the cursor's word starts quoted or escaped", () => {
      assert.deepEqual(["ls ~/a", "ls '~/a", "ls \"~/a", "ls \\~/a", "ls '~/a' ", "ls a'b"].map(t => ShellWords.read(t, false).startsQuoted),
        [false, true, true, true, false, false]);
    });

    it("keeps a backslash that ends the line", () => {
      assert.deepEqual(read("ls a\\"), [["ls"], 3, "a\\", null]);
    });

    it("starts the next command after a pipe, a semicolon or an ampersand, but not inside quotes", () => {
      assert.deepEqual(read("cat a | git switch ma"), [["git", "switch"], 19, "ma", null]);
      assert.deepEqual(read("cd x;npm run b"), [["npm", "run"], 13, "b", null]);
      assert.deepEqual(read("make && ls s"), [["ls"], 11, "s", null]);
      assert.deepEqual(read("echo \"a|b"), [["echo"], 5, "a|b", "\""]);
      assert.deepEqual(read("ls |"), [[], 4, "", null]);
    });

    it("reads a backtick as any other character", () => {
      assert.deepEqual(read("ls a`b"), [["ls"], 3, "a`b", null]);
    });
  });

  describe("reading PowerShell", () => {
    it("reads the backtick as its escape, in and out of double quotes, and the backslash as a character", () => {
      assert.deepEqual(read("cd C:\\My` Docs\\", true), [["cd"], 3, "C:\\My Docs\\", null]);
      assert.deepEqual(read("cd \"a`\"b", true), [["cd"], 3, "a\"b", "\""]);
    });

    it("reads a doubled single quote inside single quotes as one, and keeps a backtick there", () => {
      assert.deepEqual(read("cd 'it''s `x", true), [["cd"], 3, "it's `x", "'"]);
      assert.deepEqual(read("cd 'done' n", true), [["cd", "done"], 10, "n", null]);
    });
  });

  describe("writing a word back", () => {
    it("escapes bash's special characters without a quote, and leaves a home prefix and other characters as they are", () => {
      assert.equal(ShellWords.write("~/My Docs/a(1)&$b'c\"d", null, false, true, true, true), "~/My\\ Docs/a\\(1\\)\\&\\$b\\'c\\\"d");
      assert.equal(ShellWords.write("src/main.ts", null, false, true, true, false), "src/main.ts");
    });

    it("escapes a leading ~ that isn't the home folder without a quote, and leaves it as it is in one", () => {
      assert.equal(ShellWords.write("~root", null, false, true, true, false), "\\~root");
      assert.equal(ShellWords.write("~/notes", null, false, true, true, true), "~/notes");
      assert.equal(ShellWords.write("~root", "'", false, true, true, false), "'~root'");
      assert.equal(ShellWords.write("~root", "\"", false, true, true, false), "\"~root\"");
    });

    it("writes in bash's open quote, closing it but for a folder", () => {
      assert.equal(ShellWords.write("it's", "'", false, true, true, false), "'it'\\''s'");
      assert.equal(ShellWords.write("My Docs/", "'", false, false, true, false), "'My Docs/");
      assert.equal(ShellWords.write("a\"$b", "\"", false, true, true, false), "\"a\\\"\\$b\"");
    });

    it("quotes a PowerShell word only where it must, and writes in its open quote", () => {
      assert.equal(ShellWords.write("C:\\Tools\\", null, true, false, true, false), "C:\\Tools\\");
      assert.equal(ShellWords.write("My Docs\\", null, true, false, true, false), "'My Docs\\");
      assert.equal(ShellWords.write("it's", null, true, true, true, false), "'it''s'");
      assert.equal(ShellWords.write("a\"$b", "\"", true, true, true, false), "\"a`\"`$b\"");
    });

    it("escapes a PowerShell path's wildcards and its backtick for -Path, in a quote, and leaves a word that isn't a path as it is", () => {
      assert.equal(ShellWords.write("e[1]*?", null, true, true, true, false), "'e`[1`]`*`?'");
      assert.equal(ShellWords.write("t`x", null, true, true, true, false), "'t``x'");
      assert.equal(ShellWords.write("a[b", "\"", true, true, true, false), "\"a``[b\"");
      assert.equal(ShellWords.write("e[2]", null, true, true, false, false), "e[2]");
    });
  });
});
