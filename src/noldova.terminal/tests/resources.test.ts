/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { describe, it } from "vitest";

import { Resources } from "../src/resources.ts";

describe("Resources", () => {
  it("maps each shell integration mark's letter to its kind", () => {
    assert.deepEqual([...Resources.markKindLetters], [
      ["A", "PromptStart"], ["B", "PromptEnd"], ["C", "OutputStart"], ["D", "CommandEnd"], ["P", "Property"], ["R", "RightPrompt"], ["F", "ContinuationEnd"],
      ["O", "Options"], ["L", "Loaded"]]);
  });

  it("formats each message with its values", () => {
    assert.equal(Resources.formatSessionNotFound("s1"), "No terminal has the session id s1.");
    assert.equal(Resources.formatAgentTerminalRestart("s1"), "Terminal s1 belongs to an agent session, which starts and ends its shell.");
    assert.equal(Resources.formatShellNotFound("fish"), "No shell has the id fish.");
    assert.equal(Resources.formatFolderNotFound("/gone"), "The folder /gone does not exist.");
    assert.equal(Resources.formatUnknownMethod("terminal.unknown"), "The terminal module has no method terminal.unknown.");
    assert.equal(Resources.formatShellLeftRunning("s1", 42), "The shell of terminal s1, process 42, or a process it started, did not end in time.");
    assert.equal(Resources.formatLateShellLeftRunning(42), "A shell that started as the terminals ended, process 42, or a process it started, did not end in time.");
    assert.equal(Resources.formatShellLeftRunning("s1", null), "The shell of terminal s1, or a process it started, did not end in time.");
    assert.equal(Resources.formatLateShellLeftRunning(null), "A shell that started as the terminals ended, or a process it started, did not end in time.");
    assert.equal(Resources.formatWindowsTooOld("17134"),"The terminal module needs Windows 10 version 1809 (build 17763) or later for its pseudo console; this system is build 17134.");
    assert.equal(Resources.formatGlibcTooOld("2.27"), "The terminal module needs glibc 2.28 or later for its pseudo-terminal library; this system has glibc 2.27.");
    assert.equal(Resources.formatLogFailed("/logs/t1.log", "disk full"), "The log file /logs/t1.log stopped taking output: disk full");
    assert.equal(Resources.formatLogFileFull("/logs/t1.log", 16_777_216),
      "The log file /logs/t1.log reached its limit of 16777216 characters and takes no more output.");
    assert.equal(Resources.formatLogFileEnd(16_777_216), "\n[… the log stops here: it reached its limit of 16777216 characters …]\n");
    assert.equal(Resources.logFileFieldDescription,
      "The file that keeps the command's output, up to 16777216 characters; a log cut at that limit ends with a line that says so.");
    assert.equal(Resources.formatLineProcessFailed("node", "broken"), "node failed outside its own start or end: broken");
    assert.equal(Resources.lineProcessStopped, "The program was stopped before it started.");
    assert.equal(Resources.formatStartedCommandUnread("s1", "gone"), "The command started in terminal s1 could not be kept: gone");
    assert.equal(Resources.formatOneShotFailed("no such file"), "The command could not start: no such file");
    assert.equal(Resources.formatProcessExited("powershell.exe", 1), "powershell.exe exited with 1.");
    assert.equal(Resources.formatIntegrationFailed("disk full"),
      "Shells start without the module's shell integration, whose folder could not be made private or whose scripts could not be written: disk full");
    assert.equal(Resources.formatIntegrationRemovalFailed("busy"), "The module's shell integration scripts could not be removed: busy");
    assert.equal(Resources.formatFailureWithCause("git could not start.", "refused"), "git could not start. refused");
    assert.equal(Resources.formatEnvironmentCleanupFailed("busy"), "The Windows environment's temporary files were not removed: busy");
    assert.equal(Resources.formatTerminalHistoryCreateFailed("disk full"), "The folder for the terminals' stored lines could not be made: disk full");
    assert.equal(Resources.formatTerminalHistoryNotPrivate("icacls.exe exited with 5."), "A terminal opens without stored lines, whose folder could not be made private: icacls.exe exited with 5.");
  });

  it("formats the agent tools' messages with their values", () => {
    assert.equal(Resources.formatNotAbsolutePath("cwd"), "cwd must be an absolute path.");
    assert.equal(Resources.formatTooManyBytes("keys", 4), "keys must have at most 4 bytes in UTF-8.");
    assert.equal(Resources.formatNotGranted("terminal_run", "Denied"), "terminal_run did not run: its permission request ended as Denied.");
    assert.equal(Resources.formatTerminalOrigin("t1"), "terminal:t1");
    assert.equal(Resources.formatBindingNotList("terminal.shared"), "terminal.shared must be a list of terminal ids.");
    assert.equal(Resources.formatSessionEndFailed("s1", "boom"), "The terminals of the ended agent session s1 did not all close: boom");
    assert.equal(Resources.formatTerminalEnded("t1"), "Terminal t1 has ended.");
    assert.equal(Resources.formatTerminalNotIdle("t1"), "Terminal t1 isn't waiting at an empty prompt. Read it with terminal_read, interrupt it, or open another terminal.");
    assert.equal(Resources.formatAwaitingSecret("t1"), "Terminal t1 waits for a password or another secret. Only the person types it; ask them to.");
    assert.equal(Resources.formatCloseOutcomeUncertain("t1"), "The call ended while terminal t1 closed. terminal_list shows whether it's still open.");
    assert.equal(Resources.formatCancelled("terminal_run"), "terminal_run did not run: the call ended before it acted.");
    assert.equal(Resources.formatEndedWithOutput("terminal_read"), "terminal_read ended before it finished; the output so far follows.");
    assert.equal(
      Resources.formatInterruptedWithOutput("terminal_read"),
      "terminal_read ended before it finished, so the command its run started was interrupted; the output so far follows.");
    assert.equal(Resources.formatInterruptSent("t1"), "Sent an interrupt to terminal t1.");
    assert.equal(Resources.formatCommandSummary("Exited", 0, "/w", false), "\n\n[Status: Exited. Exit code: 0. Working folder: /w.]");
  });
});
