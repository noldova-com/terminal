/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";

import { JsonException, type JsonValue } from "@noldova/context.json";
import { ShellClients } from "@noldova/desktop.protocol";
import { type IMethodHandler, PermissionDecision, RequestContext, ToolResult, type ToolSession } from "@noldova/desktop.runtime";
import { RuntimeTerminalOwners, TerminalAttachment, TerminalCommandEnded, TerminalExited, TerminalLaunched, TerminalOutput, TerminalReference, TerminalRunEnded, TerminalRunOutput, TerminalRunResult, TerminalSessions, TerminalShells, TerminalSummary } from "@noldova/terminal.protocol";
import type { IBuffer, Terminal as XtermTerminal } from "@xterm/headless";
import { afterAll, afterEach, beforeAll, describe, it, vi } from "vitest";

import { RuntimePart } from "../src/api/index.ts";
import { InheritedEnvironment } from "../src/services/inherited-environment.ts";
import { ShellEnvironment } from "../src/services/shell-environment.ts";
import { XtermHeadlessLoader } from "../src/services/xterm-headless-loader.ts";
import { FakePermissionRequests } from "./fixtures/fake-permission-requests.fixture.ts";
import { type FakeEventChannel, FakeModuleLog, FakeRuntimePartContext } from "./fixtures/fake-runtime-part-context.fixture.ts";
import { PrivateFolder } from "./fixtures/private-folder.fixture.ts";
import { ProcessState } from "./fixtures/process-state.fixture.ts";
import { SupervisedTerminals } from "./fixtures/supervised-terminals.fixture.ts";

const WAIT_MS: number = 20_000;
const POLL_MS: number = 25;
const IS_WINDOWS: boolean = process.platform === "win32";
const PRIVATE_FOLDER: RegExp = /^noldova-terminal-(?:lines-\d+-)?[A-Za-z0-9]{6}$/u;
const HIGH_WATERMARK: number = 1_048_576;
const LARGE_OUTPUT: number = 4 * HIGH_WATERMARK;
const LARGE_OUTPUT_COMMAND: string = largeOutputCommand(LARGE_OUTPUT);
const OWNER: string = "example.chat/42";
const PROMPT_END_MARK: string = "\u001b]6973;B;";
const COMMAND_END_MARK: string = "\u001b]6973;D;";
const COMMAND_END_PATTERN: RegExp = /\u001b\]6973;D;[^;\u0007]*;(\d+)\u0007/g;
const RESTORE: JsonValue = { size: { cols: 80, rows: 24 }, shellId: null, storedLimit: 104_857_600 };
const fixtures: RuntimeFixture[] = [];
let terminals: SupervisedTerminals;

class RuntimeFixture {
  public readonly context: FakeRuntimePartContext = new FakeRuntimePartContext();
  public readonly part: RuntimePart;
  public readonly permissions: FakePermissionRequests = new FakePermissionRequests();
  private readonly chunks: Map<string, string[]> = new Map<string, string[]>();
  private readonly lengths: Map<string, number> = new Map<string, number>();
  private outputsRead: number = 0;

  public constructor(readsEnvironment: boolean = false, environment: Readonly<Record<string, string | undefined>> = process.env) {
    if (!readsEnvironment)
      vi.spyOn(ShellEnvironment, "create").mockImplementation(() => new InheritedEnvironment(environment));
    this.part = new RuntimePart();
    terminals.serve(this.context);
    this.context.registry.permissions.registerAnswerer("app", this.permissions, new FakeModuleLog());
    fixtures.push(this);
  }

  public get outputs(): readonly TerminalOutput[] {
    return this.published("terminal.output").map(t => TerminalOutput.fromJson(t));
  }

  public get exits(): readonly TerminalExited[] {
    return this.published("terminal.exited").map(t => TerminalExited.fromJson(t));
  }

  public get logged(): readonly (readonly unknown[])[] {
    return this.context.log.callsOf("write");
  }

  public text(sessionId: string): string {
    return this.chunksOf(sessionId).join("");
  }

  public textLength(sessionId: string): number {
    this.chunksOf(sessionId);
    return this.lengths.get(sessionId) ?? 0;
  }

  public countMarks(sessionId: string, mark: string): number {
    return this.text(sessionId).split(mark).length - 1;
  }

  public channel(event: string): FakeEventChannel {
    const channel: FakeEventChannel | undefined = this.context.events.get(event);
    assert.ok(channel !== undefined, `The part declared no event ${event}.`);
    return channel;
  }

  public published(event: string): readonly JsonValue[] {
    return this.context.events.get(event)?.published ?? [];
  }

  public async waitForEventsAsync(event: string, count: number): Promise<void> {
    await this.channel(event).waitUntilAsync(`${count} ${event} events`, () => this.published(event).length >= count);
  }

  public async waitForOutputAsync(description: string, condition: () => boolean): Promise<void> {
    await this.channel("terminal.output").waitUntilAsync(description, condition);
  }

  public async waitForPromptAfterAsync(sessionId: string, output: string): Promise<void> {
    await this.waitForOutputAsync(`Terminal ${sessionId}'s prompt after ${output}`, () => {
      const text: string = this.text(sessionId);
      const end: number = text.indexOf(COMMAND_END_MARK, text.lastIndexOf(output));
      return text.includes(output) && end >= 0 && text.includes(PROMPT_END_MARK, end);
    });
  }

  public async waitForMatchAsync(sessionId: string, pattern: RegExp): Promise<string> {
    await this.waitForOutputAsync(`Terminal ${sessionId}'s output matching ${pattern.source}`, () => pattern.test(this.text(sessionId)));
    return pattern.exec(this.text(sessionId))?.[1] ?? "";
  }

  public async callAsync(method: string, payload: JsonValue, client: string = ShellClients.mainProcess, connection: number = 1,
    window: number | null = 1): Promise<JsonValue> {
    const handler: IMethodHandler | undefined = this.context.methods.get(method);
    assert.ok(handler !== undefined, `The part has no method ${method}.`);
    return handler.handleAsync(new RequestContext(client, payload, new AbortController().signal, connection, window));
  }

  public async listAsync(client: string = ShellClients.mainProcess, connection: number = 1, window: number | null = 1): Promise<readonly (string | null)[][]> {
    return TerminalSessions.fromJson(await this.callAsync("terminal.sessions", null, client, connection, window)).sessions.map(t => [t.sessionId, t.owner]);
  }

  public openToolSession(folder: string, owner: string | null): ToolSession {
    return this.context.tools.openSession("chats.chat", { "terminal.folder": folder, "terminal.shared": [], ...(owner === null ? {} : { "terminal.owner": owner }) });
  }

  public async openAgentAsync(session: ToolSession): Promise<string> {
    this.permissions.answerNext(PermissionDecision.AllowedOnce);
    const result: unknown = await session.callAsync("terminal_open", {});
    assert.ok(result instanceof ToolResult, `The agent's open failed: ${JSON.stringify(result)}`);
    const sessionId: unknown = result.structured?.["terminal_id"];
    assert.ok(typeof sessionId === "string");
    return sessionId;
  }

  public async readPidAsync(sessionId: string): Promise<number> {
    await this.typeAsync(sessionId, IS_WINDOWS ? "echo \"pid=$PID\"\r" : "echo \"pid=$$\"\r");
    return Number(await this.waitForMatchAsync(sessionId, /pid=(\d+)/u));
  }

  public async openAsync(folder: string, columns: number = 400): Promise<string> {
    const shells: TerminalShells = TerminalShells.fromJson(await this.callAsync("terminal.shells", null));
    const shell: string | undefined = shells.shells.find(t => t.isDefault)?.id;
    assert.ok(shell !== undefined, "No default shell was found.");
    return TerminalReference.fromJson(await this.callAsync("terminal.open", { shellId: shell, folder, size: { cols: columns, rows: 30 }, storedLimit: 104_857_600 })).sessionId;
  }

  public async typeAsync(sessionId: string, data: string): Promise<void> {
    await this.callAsync("terminal.input", { sessionId, data });
  }

  public async echoAsync(sessionId: string, word: string): Promise<string> {
    const printed: string = `${word}-${randomUUID().slice(0, 8)}`;
    await this.typeAsync(sessionId, `echo ${printed.slice(0, -1)}'${printed.slice(-1)}'\r`);
    await this.waitForTextAsync(sessionId, printed);
    return printed;
  }

  public async waitForTextAsync(sessionId: string, text: string): Promise<void> {
    let searched: number = 0;
    let tail: string = "";
    await this.waitForOutputAsync(`Terminal ${sessionId}'s output ${JSON.stringify(text)}`, () => {
      const chunks: readonly string[] = this.chunksOf(sessionId);
      for (; searched < chunks.length; searched++) {
        const searchable: string = tail + (chunks[searched] ?? "");
        if (searchable.includes(text))
          return true;
        tail = searchable.slice(Math.max(searchable.length - text.length + 1, 0));
      }
      return false;
    });
  }

  private chunksOf(sessionId: string): readonly string[] {
    const published: readonly JsonValue[] = this.published("terminal.output");
    for (; this.outputsRead < published.length; this.outputsRead++) {
      const output: TerminalOutput = TerminalOutput.fromJson(published[this.outputsRead]);
      const chunks: string[] = this.chunks.get(output.sessionId) ?? [];
      chunks.push(output.data);
      this.chunks.set(output.sessionId, chunks);
      this.lengths.set(output.sessionId, (this.lengths.get(output.sessionId) ?? 0) + output.data.length);
    }
    return this.chunks.get(sessionId) ?? [];
  }
}

function largeOutputCommand(bytes: number): string {
  return IS_WINDOWS
    ? `[Console]::Out.Write('x' * ${bytes}); [Console]::Out.Write('done-' + 'marker')\r`
    : `head -c ${bytes} /dev/zero | tr '\\0' x; printf 'done-%s' marker\r`;
}

async function drawAsync(snapshot: string, columns: number, rows: number): Promise<readonly string[]> {
  const screen: XtermTerminal = XtermHeadlessLoader.createTerminal({ allowProposedApi: true, cols: columns, rows });
  await new Promise<void>(resolve => screen.write(snapshot, resolve));
  const buffer: IBuffer = screen.buffer.active;
  const drawn: string[] = [];
  let line: string = "";
  for (let i = 0; i < buffer.length; i++) {
    if (i > 0 && buffer.getLine(i)?.isWrapped !== true) {
      drawn.push(line);
      line = "";
    }
    line += buffer.getLine(i)?.translateToString(buffer.getLine(i + 1)?.isWrapped !== true) ?? "";
  }
  drawn.push(line);
  screen.dispose();
  return drawn;
}

describe("the runtime part with real shells", () => {
  let folder: string = "";

  beforeAll(async () => {
    folder = await mkdtemp(join(tmpdir(), "noldova-terminal-runtime-"));
    terminals = await SupervisedTerminals.createAsync();
  });

  afterEach(async () => {
    for (const fixture of fixtures.splice(0)) {
      await fixture.part.deactivateAsync();
      await fixture.context.endAsync();
    }
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await terminals.endAsync();
    await rm(folder, { force: true, recursive: true });
  });

  it("echoes input back, keeps answering after a resize with no window, and closes with no shell left", async () => {
    const fixture: RuntimeFixture = new RuntimeFixture(true);
    await fixture.part.activateAsync(fixture.context);
    const sessionId: string = await fixture.openAsync(folder);

    await fixture.echoAsync(sessionId, "first-echo");
    await fixture.callAsync("terminal.resize", { sessionId, size: { cols: 60, rows: 20 } });
    const second: string = await fixture.echoAsync(sessionId, "second-echo");
    const attachment: TerminalAttachment = TerminalAttachment.fromJson(await fixture.callAsync("terminal.attach", { sessionId, paneId: "p1" }));
    assert.ok(attachment.snapshot.includes(second));
    assert.deepEqual(attachment.size.toJson(), { cols: 60, rows: 20 });
    assert.equal(attachment.windowsPty === null, !IS_WINDOWS);

    await fixture.callAsync("terminal.close", { sessionId });

    assert.deepEqual(fixture.exits.map(t => [t.sessionId, t.exit.endedBy]), [[sessionId, "Close"]]);
    assert.deepEqual(await fixture.callAsync("terminal.sessions", null), { sessions: [] });
    await fixture.part.deactivateAsync();
  });

  it("makes its shell integration's folder and its stored lines' folder private, whatever the temporary folder passes on", async () => {
    const parent: string = await mkdtemp(join(tmpdir(), "noldova-terminal-parent-"));
    let fixture: RuntimeFixture | null = null;
    try {
      PrivateFolder.passOnRead(parent);
      for (const name of ["TEMP", "TMP", "TMPDIR"])
        vi.stubEnv(name, parent);
      fixture = new RuntimeFixture();
      await fixture.part.activateAsync(fixture.context);
      const sessionId: string = await fixture.openAsync(folder);

      const names: string[] = (await readdir(parent)).filter(t => PRIVATE_FOLDER.test(t));

      assert.equal(names.length, 2, `The part's folders: ${names.join(", ")}`);
      for (const name of names)
        PrivateFolder.assertPrivate(join(parent, name));
      await fixture.callAsync("terminal.close", { sessionId });
    }
    finally {
      await fixture?.part.deactivateAsync();
      vi.unstubAllEnvs();
      await rm(parent, { force: true, recursive: true });
    }
  });

  it("opens the default shell in the person's home folder when the pane names neither", async () => {
    const fixture: RuntimeFixture = new RuntimeFixture();
    await fixture.part.activateAsync(fixture.context);
    const shells: TerminalShells = TerminalShells.fromJson(await fixture.callAsync("terminal.shells", null));
    const sessionId: string = TerminalReference.fromJson(await fixture.callAsync("terminal.open", { shellId: null, folder: null, size: { cols: 400, rows: 30 }, storedLimit: 104_857_600 })).sessionId;

    const sessions: TerminalSessions = TerminalSessions.fromJson(await fixture.callAsync("terminal.sessions", null));

    assert.deepEqual(sessions.sessions.map(t => [t.sessionId, t.shellId, t.folder]), [[sessionId, shells.shells.find(t => t.isDefault)?.id, homedir()]]);
    await fixture.callAsync("terminal.close", { sessionId });
    await fixture.part.deactivateAsync();
  });

  it("[fish] runs fish, the shell with no integration, and closes it", async context => {
    context.skip(process.platform !== "linux", "fish is tested on Linux, where the checks install it.");
    const fixture: RuntimeFixture = new RuntimeFixture();
    await fixture.part.activateAsync(fixture.context);
    const shells: readonly string[] = TerminalShells.fromJson(await fixture.callAsync("terminal.shells", null)).shells.map(t => t.id);
    context.skip(!shells.includes("fish"), "fish is not installed.");
    const sessionId: string = TerminalReference.fromJson(await fixture.callAsync("terminal.open", { shellId: "fish", folder, size: { cols: 400, rows: 30 },
      storedLimit: 104_857_600 })).sessionId;

    await fixture.typeAsync(sessionId, "echo fish-(math 6 \\* 7)\r");
    await fixture.waitForTextAsync(sessionId, "fish-42");

    await fixture.callAsync("terminal.close", { sessionId });
    assert.deepEqual(fixture.exits.map(t => [t.sessionId, t.exit.endedBy]), [[sessionId, "Close"]]);
    await fixture.part.deactivateAsync();
  });

  it("reports the shell's own exit and its code", async () => {
    const fixture: RuntimeFixture = new RuntimeFixture();
    await fixture.part.activateAsync(fixture.context);
    const sessionId: string = await fixture.openAsync(folder);

    await fixture.typeAsync(sessionId, "exit 3\r");
    await fixture.waitForEventsAsync("terminal.exited", 1);

    const exited: TerminalExited | undefined = fixture.exits[0];
    assert.equal(exited?.exit.endedBy, "Exit");
    if (!IS_WINDOWS)
      assert.equal(exited?.exit.exitCode, 3);
    await fixture.part.deactivateAsync();
  });

  it("launches a shell that reads an app's variables, and refuses a name the terminal sets in another case, starting nothing", async () => {
    const fixture: RuntimeFixture = new RuntimeFixture(false, { ...process.env, noldova_launch_case: "inherited-value" });
    await fixture.part.activateAsync(fixture.context);
    const launch: Record<string, JsonValue> = { shellId: null, folder, size: { cols: 400, rows: 30 }, storedLimit: 104_857_600, notice: null,
      command: null, opensTab: true };

    await assert.rejects(fixture.callAsync("terminal.launch", { ...launch, environment: { Term: "dumb" } }),
      (error: unknown) => error instanceof JsonException && error.message.includes("environment.Term"));
    assert.deepEqual(await fixture.callAsync("terminal.sessions", null), { sessions: [] });
    const launched: TerminalLaunched = TerminalLaunched.fromJson(await fixture.callAsync("terminal.launch",
      { ...launch, environment: { NOLDOVA_LAUNCH_CASE: "launched-value" } }));
    const sessionId: string = launched.sessionId ?? "";
    await fixture.typeAsync(sessionId, IS_WINDOWS ? "echo \"read=$env:noldova_launch_case.\"\r" : "echo \"read=$NOLDOVA_LAUNCH_CASE $noldova_launch_case.\"\r");

    await fixture.waitForTextAsync(sessionId, IS_WINDOWS ? "read=launched-value." : "read=launched-value inherited-value.");
    await fixture.callAsync("terminal.close", { sessionId });
    await fixture.part.deactivateAsync();
  });

  it("types and enters a launch's command once the shell is ready, and the shell runs it with the launch's variables",
    async () => {
    const fixture: RuntimeFixture = new RuntimeFixture();
    await fixture.part.activateAsync(fixture.context);
    const command: string = IS_WINDOWS ? "echo \"ran=$env:NOLDOVA_LAUNCH_COMMAND.\"" : "echo \"ran=$NOLDOVA_LAUNCH_COMMAND.\"";

    const launched: TerminalLaunched = TerminalLaunched.fromJson(await fixture.callAsync("terminal.launch", { shellId: null, folder,
      size: { cols: 400, rows: 30 }, storedLimit: 104_857_600, environment: { NOLDOVA_LAUNCH_COMMAND: "launched" }, notice: null, command, opensTab: true }));
    const sessionId: string = launched.sessionId ?? "";

    await fixture.waitForTextAsync(sessionId, "ran=launched.");
    assert.match(fixture.text(sessionId), /NOLDOVA_LAUNCH_COMMAND/u);
    await fixture.callAsync("terminal.close", { sessionId });
    await fixture.part.deactivateAsync();
  });

  it("tells a launch's command's end with its exit code from the default shell's integration, and not the person's command after it, while the shell runs on",
    async () => {
    const fixture: RuntimeFixture = new RuntimeFixture();
    await fixture.part.activateAsync(fixture.context);

    const launched: TerminalLaunched = TerminalLaunched.fromJson(await fixture.callAsync("terminal.launch", { shellId: null, folder,
      size: { cols: 400, rows: 30 }, storedLimit: 104_857_600, environment: {}, notice: null, command: IS_WINDOWS ? "cmd /c exit 3" : "sh -c \"exit 3\"", opensTab: true }));
    const sessionId: string = launched.sessionId ?? "";
    await fixture.waitForEventsAsync("terminal.launchCommandEnded", 1);
    await fixture.typeAsync(sessionId, IS_WINDOWS ? "echo \"after=$(1+1).\"\r" : "echo \"after=$((1+1)).\"\r");
    await fixture.waitForTextAsync(sessionId, "after=2.");

    assert.deepEqual(fixture.published("terminal.launchCommandEnded"), [{ sessionId, exitCode: 3 }]);
    assert.deepEqual(fixture.exits, []);
    await fixture.callAsync("terminal.close", { sessionId });
    await fixture.part.deactivateAsync();
  });

  const subshellShells: readonly (readonly [string, string])[] = [["bash", process.platform === "darwin" ? "/bin/bash" : "bash"], ["zsh", "zsh"]];
  for (const [shellId, file] of subshellShells)
    it(`[${shellId}] tells a launched subshell's end with its exit code, 3, never the person's next command's, in macOS's /bin/bash 3.2 too`, async context => {
      context.skip(IS_WINDOWS, "Windows has no shell with the id bash or zsh; Git Bash goes by its own id there.");
      const fixture: RuntimeFixture = new RuntimeFixture();
      await fixture.part.activateAsync(fixture.context);
      const shells: readonly string[] = TerminalShells.fromJson(await fixture.callAsync("terminal.shells", null)).shells.map(t => t.id);
      context.skip(!shells.includes(shellId), `${shellId} is not installed.`);

      const launched: TerminalLaunched = TerminalLaunched.fromJson(await fixture.callAsync("terminal.launch", { shellId, folder,
        size: { cols: 400, rows: 30 }, storedLimit: 104_857_600, environment: {}, notice: null, command: "(exit 3)", opensTab: true }));
      const sessionId: string = launched.sessionId ?? "";
      await fixture.waitForEventsAsync("terminal.launchCommandEnded", 1);
      await fixture.typeAsync(sessionId, file.startsWith("/") ? `echo "after=$((1+1)) in $BASH."\r` : `echo "after=$((1+1)) in ${file}."\r`);
      await fixture.waitForTextAsync(sessionId, `after=2 in ${file}.`);

      const ended: readonly JsonValue[] = fixture.published("terminal.launchCommandEnded");
      assert.equal(ended.length, 1);
      assert.equal(TerminalCommandEnded.fromJson(ended[0]).exitCode, 3);
      await fixture.callAsync("terminal.close", { sessionId });
      await fixture.part.deactivateAsync();
    });

  const wrappedPrompt: string = "wrapped-prompt-wider-than-twenty-columns> ";
  const wrappedShells: readonly (readonly [string, string | null, string, (name: string, left: number, right: number) => string])[] = [
    ["bash", IS_WINDOWS ? "Windows has no shell with the id bash; Git Bash goes by its own id there." : null, `PS1='${wrappedPrompt}'`,
      (name, left, right) => `echo "${name}=$((${left}+${right}))."`],
    ["zsh", IS_WINDOWS ? "zsh doesn't run on Windows." : null, `PROMPT='${wrappedPrompt}'`, (name, left, right) => `echo "${name}=$((${left}+${right}))."`],
    ["pwsh", null, `$Global:__NoldovaPrompt = { '${wrappedPrompt}' }`, (name, left, right) => `echo "${name}=$(${left}+${right})."`],
    ["powershell", IS_WINDOWS ? null : "Windows PowerShell exists only on Windows.", `$Global:__NoldovaPrompt = { '${wrappedPrompt}' }`,
      (name, left, right) => `echo "${name}=$(${left}+${right})."`]
  ];
  for (const [shellId, platformGap, setPrompt, sum] of wrappedShells)
    it(`[${shellId}] runs into the owner's ${shellId} at its prompt when the prompt wraps over several rows`, async context => {
      context.skip(platformGap !== null, platformGap ?? "");
      const fixture: RuntimeFixture = new RuntimeFixture();
      await fixture.part.activateAsync(fixture.context);
      const shells: readonly string[] = TerminalShells.fromJson(await fixture.callAsync("terminal.shells", null)).shells.map(t => t.id);
      context.skip(!shells.includes(shellId), `${shellId} is not installed.`);
      const run = async (command: string): Promise<TerminalRunResult> =>
        TerminalRunResult.fromJson(await fixture.callAsync("terminal.run", { owner: OWNER, command, folder, shellKinds: [], shellId,
          size: { cols: 20, rows: 10 }, storedLimit: 104_857_600, sessionId: null, whenBusy: "Refuse", opensTab: true }));

      const probe = setTimeout(() => {
        for (const id of new Set(fixture.outputs.map(t => t.sessionId)))
          console.log("PROBE", shellId, id, JSON.stringify(fixture.text(id).slice(-4000)));
        console.log("PROBE LOG", JSON.stringify(fixture.logged).slice(-4000));
      }, 50_000);
      context.onTestFinished(() => clearTimeout(probe));
      const first: TerminalRunResult = await run(`${setPrompt}; ${sum("first", 1, 1)}`);
      const sessionId: string = first.sessionId ?? "";
      await fixture.waitForTextAsync(sessionId, "columns> ");
      await fixture.waitForPromptAfterAsync(sessionId, "first=2.");
      const second: TerminalRunResult = await run(sum("second", 3, 3));

      const text: string = fixture.text(sessionId);
      assert.equal(second.sessionId, sessionId, `The run opened another shell. After the last prompt end: ${JSON.stringify(text.slice(text.lastIndexOf(PROMPT_END_MARK)))}`);
      await fixture.waitForTextAsync(sessionId, "second=6.");
      await fixture.part.deactivateAsync();
    });

  for (const [shellId, platformGap] of wrappedShells)
    it(`[${shellId}] tells the window that asked of a run's end in the owner's ${shellId}, with its code, its last line's for two lines, or as TerminalEnded when its terminal closes first`,
      async context => {
        context.skip(platformGap !== null, platformGap ?? "");
        const fixture: RuntimeFixture = new RuntimeFixture();
        await fixture.part.activateAsync(fixture.context);
        const shells: readonly string[] = TerminalShells.fromJson(await fixture.callAsync("terminal.shells", null)).shells.map(t => t.id);
        context.skip(!shells.includes(shellId), `${shellId} is not installed.`);
        const isPowerShell: boolean = shellId === "pwsh" || shellId === "powershell";
        const exit = (code: number): string => isPowerShell && IS_WINDOWS ? `cmd /c exit ${code}` : `sh -c 'exit ${code}'`;
        const run = async (command: string, sessionId: string | null, whenBusy: string = "Refuse"): Promise<TerminalRunResult> =>
          TerminalRunResult.fromJson(await fixture.callAsync("terminal.run", { owner: OWNER, command, folder, shellKinds: [], shellId,
            size: { cols: 120, rows: 30 }, storedLimit: 104_857_600, sessionId, whenBusy, opensTab: true }));
        const endOf = async (result: TerminalRunResult): Promise<TerminalRunEnded> => {
          const find = (): TerminalRunEnded | undefined => fixture.published("terminal.runEnded").map(t => TerminalRunEnded.fromJson(t)).find(t => t.runId === result.runId);
          await fixture.channel("terminal.runEnded").waitUntilAsync(`The end of run ${result.runId}`, () => find() !== undefined);
          const ended: TerminalRunEnded | undefined = find();
          assert.ok(ended !== undefined, "The run's end didn't come.");
          return ended;
        };
        const codeOf = async (result: TerminalRunResult): Promise<readonly unknown[]> => {
          const ended: TerminalRunEnded = await endOf(result);
          return [result.endedRuns, ended.endedBy, ended.exitCode];
        };
        let since: number = 0;
        const runAfterEndAsync = async (command: string, sessionId: string, previousCode: number, whenBusy: string = "Refuse"): Promise<TerminalRunResult> => {
          await fixture.waitForOutputAsync(`Terminal ${sessionId}'s prompt after a run that exited ${previousCode}`, () => {
            const text: string = fixture.text(sessionId).slice(since);
            const end: RegExpExecArray | undefined = [...text.matchAll(COMMAND_END_PATTERN)].findLast(t => t[1] === String(previousCode));
            return end !== undefined && text.includes(PROMPT_END_MARK, end.index);
          });
          since = fixture.text(sessionId).length;
          const result: TerminalRunResult = await run(command, sessionId, whenBusy);
          assert.equal(result.outcome, "Typed");
          return result;
        };

        const failed: TerminalRunResult = await run(exit(3), null);
        const sessionId: string | null = failed.sessionId;
        assert.ok(sessionId !== null, "The first run opened no terminal.");
        const failedEnd: readonly unknown[] = await codeOf(failed);
        const passedEnd: readonly unknown[] = await codeOf(await runAfterEndAsync(exit(0), sessionId, 3));
        const twoLinesEnd: readonly unknown[] = await codeOf(await runAfterEndAsync(`${exit(0)}\n${exit(4)}`, sessionId, 0));
        const sleeping: TerminalRunResult = await runAfterEndAsync(isPowerShell ? "Start-Sleep -Seconds 30" : "sleep 30", sessionId, 4, "Interrupt");
        await fixture.callAsync("terminal.close", { sessionId });

        assert.deepEqual([failedEnd, passedEnd, twoLinesEnd], [[[], "Command", 3], [[], "Command", 0], [[], "Command", 4]]);
        assert.deepEqual([sleeping.endedRuns, (await endOf(sleeping)).endedBy], [[], "TerminalEnded"]);
        await fixture.part.deactivateAsync();
      });

  it("answers a run into a new Command Prompt with its own end as NoIntegration, and tells no end later", async context => {
    context.skip(!IS_WINDOWS, "Command Prompt exists only on Windows.");
    const fixture: RuntimeFixture = new RuntimeFixture();
    await fixture.part.activateAsync(fixture.context);

    const result: TerminalRunResult = TerminalRunResult.fromJson(await fixture.callAsync("terminal.run", { owner: OWNER, command: "echo done", folder,
      shellKinds: [], shellId: "cmd", size: { cols: 120, rows: 30 }, storedLimit: 104_857_600, sessionId: null, whenBusy: "Refuse", opensTab: true }));
    await fixture.waitForTextAsync(result.sessionId ?? "", "done");

    assert.deepEqual([result.outcome, result.endedRuns.map(t => t.toJson()), fixture.published("terminal.runEnded")],
      ["Typed", [{ sessionId: result.sessionId, runId: result.runId, endedBy: "NoIntegration", exitCode: null }], []]);
    await fixture.part.deactivateAsync();
  });

  it("runs into a given terminal, gives each run's lines up to the next run's prompt with the person's command between, and refuses or interrupts a busy one",
    async () => {
    const fixture: RuntimeFixture = new RuntimeFixture();
    await fixture.part.activateAsync(fixture.context);
    const run = async (command: string, sessionId: string | null, whenBusy: string = "Refuse"): Promise<TerminalRunResult> =>
      TerminalRunResult.fromJson(await fixture.callAsync("terminal.run", { owner: OWNER, command, folder, shellKinds: [], shellId: null,
        size: { cols: 400, rows: 30 }, storedLimit: 104_857_600, sessionId, whenBusy, opensTab: true }));
    const output = async (result: TerminalRunResult): Promise<string> => TerminalRunOutput.fromJson(await fixture.callAsync("terminal.runOutput",
      { sessionId: result.sessionId, runId: result.runId, maximumLines: 2_000 })).lines.map(t => t.text).join("\n");
    const sum = (name: string, left: number, right: number): string => IS_WINDOWS ? `echo "${name}=$(${left}+${right})."` : `echo "${name}=$((${left}+${right}))."`;

    const first: TerminalRunResult = await run(sum("first", 1, 1), null);
    const sessionId: string = first.sessionId ?? "";
    await fixture.waitForPromptAfterAsync(sessionId, "first=2.");
    await fixture.typeAsync(sessionId, `${sum("own", 2, 2)}\r`);
    await fixture.waitForPromptAfterAsync(sessionId, "own=4.");
    const second: TerminalRunResult = await run(sum("second", 3, 3), sessionId);
    assert.equal(second.outcome, "Typed");
    await fixture.waitForTextAsync(sessionId, "second=6.");

    const [firstText, secondText] = [await output(first), await output(second)];
    assert.match(firstText, /first=2\.[\s\S]*own=4\./u);
    assert.doesNotMatch(firstText, /second=/u);
    assert.match(secondText, /second=6\./u);
    assert.doesNotMatch(secondText, /first=|own=/u);

    const starts: number = fixture.countMarks(sessionId, "\u001b]6973;C;");
    await fixture.waitForPromptAfterAsync(sessionId, "second=6.");
    assert.equal((await run(IS_WINDOWS ? "Start-Sleep -Seconds 30" : "sleep 30", sessionId)).outcome, "Typed");
    const refused: TerminalRunResult = await run(sum("refused", 4, 4), sessionId);
    assert.equal(refused.outcome, "Busy");
    const isStarted: boolean = fixture.countMarks(sessionId, "\u001b]6973;C;") > starts;
    const interruptedAt: number = performance.now();
    const interrupted: TerminalRunResult = await run(sum("interrupted", 5, 5), sessionId, "Interrupt");
    const answeredIn: number = performance.now() - interruptedAt;
    assert.equal(interrupted.outcome, "Typed", `The interrupt answered ${interrupted.outcome} after ${Math.round(answeredIn)} ms, the sleep ` +
      `${isStarted ? "had" : "hadn't"} started when it came. RAW ${JSON.stringify(fixture.text(sessionId).slice(-1500))}`);
    await fixture.waitForTextAsync(sessionId, "interrupted=10.");

    assert.doesNotMatch(fixture.text(sessionId), /refused/u);
    await fixture.callAsync("terminal.close", { sessionId });
    await fixture.part.deactivateAsync();
  });

  it("sends 4 MiB in order with nothing lost to a pane that keeps up", async () => {
    const fixture: RuntimeFixture = new RuntimeFixture();
    await fixture.part.activateAsync(fixture.context);
    const sessionId: string = await fixture.openAsync(folder);
    await fixture.callAsync("terminal.attach", { sessionId, paneId: "p1" });
    const acks: Promise<unknown>[] = [];
    const stopAcknowledging: () => void = fixture.channel("terminal.output").listen(t => {
      const offset: number = TerminalOutput.fromJson(t).endOffset;
      acks.push(Promise.resolve().then(() => fixture.callAsync("terminal.ack", { sessionId, paneId: "p1", offset })).then(() => null, (error: unknown) => error));
    });

    try {
      await fixture.typeAsync(sessionId, LARGE_OUTPUT_COMMAND);
      await fixture.waitForTextAsync(sessionId, "done-marker");
    }
    finally {
      stopAcknowledging();
    }
    assert.deepEqual((await Promise.all(acks)).filter(t => t !== null), [], "An acknowledgement failed.");

    const outputs: readonly TerminalOutput[] = fixture.outputs;
    for (let index: number = 1; index < outputs.length; index++)
      assert.equal(outputs[index]?.offset, outputs[index - 1]?.endOffset, `Batch ${index} does not start where batch ${index - 1} ended.`);
    assert.ok(fixture.text(sessionId).split("x").length > LARGE_OUTPUT, "Some of the 4 MiB of output was lost.");
    await fixture.part.deactivateAsync();
  });

  it("detaches a pane that stops acknowledging, then lets the shell finish", async () => {
    const fixture: RuntimeFixture = new RuntimeFixture();
    await fixture.part.activateAsync(fixture.context);
    const sessionId: string = await fixture.openAsync(folder);
    await fixture.callAsync("terminal.attach", { sessionId, paneId: "p1" });

    await fixture.typeAsync(sessionId, LARGE_OUTPUT_COMMAND);
    await fixture.waitForEventsAsync("terminal.detached", 1);
    assert.ok(!fixture.text(sessionId).includes("done-marker"), "The shell finished while a pane held it back.");
    await fixture.waitForTextAsync(sessionId, "done-marker");

    assert.deepEqual(fixture.published("terminal.detached"), [{ sessionId, paneId: "p1" }]);
    await fixture.part.deactivateAsync();
  });

  it("opens a pane's missing folder in the home folder, and keeps its note on screen after the shell's first prompt and a resize", async () => {
    const fixture: RuntimeFixture = new RuntimeFixture();
    await fixture.part.activateAsync(fixture.context);
    const sessionId: string = await fixture.openAsync(join(folder, "gone"), 100);

    const afterNote: string = await fixture.echoAsync(sessionId, "after-note");
    await fixture.callAsync("terminal.resize", { sessionId, size: { cols: 120, rows: 30 } });
    const afterResize: string = await fixture.echoAsync(sessionId, "after-resize");
    const attachment: TerminalAttachment = TerminalAttachment.fromJson(await fixture.callAsync("terminal.attach", { sessionId, paneId: "p1" }));

    assert.match(attachment.snapshot, /^\S*The folder .*gone does not exist, so this terminal opened in the home folder\./u);
    const note: number = attachment.snapshot.indexOf(afterNote);
    assert.ok(note >= 0 && note < attachment.snapshot.lastIndexOf(afterResize), "The output after the note is not above the output after the resize.");
    await fixture.part.deactivateAsync();
  });

  it("closes a shell whose output a silent pane holds paused, before the pane stalls", async () => {
    const fixture: RuntimeFixture = new RuntimeFixture();
    await fixture.part.activateAsync(fixture.context);
    const sessionId: string = await fixture.openAsync(folder);
    await fixture.callAsync("terminal.attach", { sessionId, paneId: "p1" });
    await fixture.typeAsync(sessionId, LARGE_OUTPUT_COMMAND);
    await fixture.waitForOutputAsync(`Terminal ${sessionId}'s output past the high watermark`, () => fixture.textLength(sessionId) > HIGH_WATERMARK);

    const closing: number = Date.now();
    await fixture.callAsync("terminal.close", { sessionId });
    const closeMs: number = Date.now() - closing;

    const ended: readonly unknown[] = [fixture.exits.map(t => t.exit.endedBy), fixture.published("terminal.detached")];
    assert.deepEqual(ended, [["Close"], []],
      `Got ${JSON.stringify(ended)} after a close of ${closeMs} ms, with the module's log ${JSON.stringify(fixture.logged)}.`);
    await fixture.part.deactivateAsync();
  });

  it("ends every shell when the part deactivates", async () => {
    const fixture: RuntimeFixture = new RuntimeFixture();
    await fixture.part.activateAsync(fixture.context);
    const first: string = await fixture.openAsync(folder);
    const second: string = await fixture.openAsync(folder);
    await fixture.echoAsync(first, "ready-one");
    await fixture.echoAsync(second, "ready-two");

    await fixture.part.deactivateAsync();

    assert.deepEqual(fixture.exits.map(t => t.sessionId).sort(), [first, second].sort());
    assert.deepEqual(fixture.logged, []);
  });

  it("restarts a running shell in the same terminal, ending the old one without sending its end and keeping its output above the new one's",
    async () => {
    const fixture: RuntimeFixture = new RuntimeFixture();
    await fixture.part.activateAsync(fixture.context);
    const sessionId: string = await fixture.openAsync(folder);
    const pid: number = await fixture.readPidAsync(sessionId);
    const beforeRestart: string = await fixture.echoAsync(sessionId, "before-restart");

    assert.equal(await fixture.callAsync("terminal.restart", { sessionId, size: { cols: 80, rows: 24 } }), null);
    await vi.waitFor(() => assert.equal(ProcessState.isRunning(pid), false, `Shell process ${pid} is still running.`), { timeout: WAIT_MS, interval: POLL_MS });
    const afterRestart: string = await fixture.echoAsync(sessionId, "after-restart");
    const attachment: TerminalAttachment = TerminalAttachment.fromJson(await fixture.callAsync("terminal.attach", { sessionId, paneId: "p1" }));

    const before: number = attachment.snapshot.indexOf(beforeRestart);
    assert.ok(before >= 0 && before < attachment.snapshot.lastIndexOf(afterRestart), "The old output is not above the new shell's.");
    assert.equal(attachment.exit, null);
    assert.deepEqual(fixture.published("terminal.restarted"), [{ sessionId }]);
    assert.deepEqual(fixture.logged, []);
    assert.deepEqual(fixture.exits, []);
    await fixture.part.deactivateAsync();
  });

  it("ends the shells a connection opened when it closes, not when one of its windows closes for good, and keeps them for the next run",
    async () => {
    const fixture: RuntimeFixture = new RuntimeFixture();
    await fixture.part.activateAsync(fixture.context);
    const sessionId: string = await fixture.openAsync(folder);
    const pid: number = await fixture.readPidAsync(sessionId);

    await fixture.context.closeClientAsync(1, 1);
    const isRunningAfterWindow: boolean = ProcessState.isRunning(pid);
    await fixture.context.closeClientAsync(1, null);

    assert.equal(isRunningAfterWindow, true);
    await vi.waitFor(() => assert.equal(ProcessState.isRunning(pid), false, `Shell process ${pid} is still running.`), { timeout: WAIT_MS, interval: POLL_MS });
    assert.deepEqual(fixture.context.database.readAll("SELECT session_id FROM terminals").map(t => t["session_id"]), [sessionId]);
    await fixture.part.deactivateAsync();
  });

  it("restores the person's kept terminals for the app's next connection and no other's, as the app's", async () => {
    const fixture: RuntimeFixture = new RuntimeFixture();
    await fixture.part.activateAsync(fixture.context);
    const sessionId: string = await fixture.openAsync(folder);
    const pid: number = await fixture.readPidAsync(sessionId);
    await fixture.context.closeClientAsync(1, null);
    await vi.waitFor(() => assert.equal(ProcessState.isRunning(pid), false, `Shell process ${pid} is still running.`), { timeout: WAIT_MS, interval: POLL_MS });

    await fixture.callAsync("terminal.restore", RESTORE, ShellClients.commandLine, 2, null);
    const commandLine: readonly (string | null)[][] = await fixture.listAsync(ShellClients.commandLine, 2, null);
    await fixture.callAsync("terminal.restore", RESTORE, ShellClients.mainProcess, 3, 1);

    assert.deepEqual(commandLine, []);
    assert.deepEqual(await fixture.listAsync(ShellClients.mainProcess, 3, 1), [[sessionId, null]]);
    assert.deepEqual(await fixture.listAsync(ShellClients.commandLine, 2, null), []);
    await fixture.part.deactivateAsync();
  });

  it("shows an agent's terminal with an owner to the app's windows, tells them it opened, and takes the person's typing, and ends it when the app's connection closes",
    async () => {
    const fixture: RuntimeFixture = new RuntimeFixture();
    await fixture.part.activateAsync(fixture.context);
    assert.deepEqual(await fixture.listAsync(), []);
    assert.deepEqual(await fixture.listAsync(ShellClients.commandLine, 2, null), []);

    const sessionId: string = await fixture.openAgentAsync(fixture.openToolSession(folder, OWNER));
    const pid: number = await fixture.readPidAsync(sessionId);
    const listed: readonly (string | null)[][] = await fixture.listAsync();
    const commandLine: readonly (string | null)[][] = await fixture.listAsync(ShellClients.commandLine, 2, null);
    await fixture.context.closeClientAsync(1, 1);
    const isRunningAfterWindow: boolean = ProcessState.isRunning(pid);
    await fixture.context.closeClientAsync(1, null);

    assert.deepEqual(listed, [[sessionId, OWNER]]);
    assert.deepEqual(commandLine, []);
    assert.deepEqual(fixture.channel("terminal.opened").targets, ["1/1"]);
    assert.equal(isRunningAfterWindow, true);
    await vi.waitFor(() => assert.equal(ProcessState.isRunning(pid), false, `Shell process ${pid} is still running.`), { timeout: WAIT_MS, interval: POLL_MS });
    await fixture.part.deactivateAsync();
  });

  it("runs an agent's allowed command after a window resized its bash at the prompt while the person decided",
    async context => {
    context.skip(IS_WINDOWS, "Windows has no shell with the id bash; Git Bash goes by its own id there.");
    const fixture: RuntimeFixture = new RuntimeFixture();
    await fixture.part.activateAsync(fixture.context);
    const shells: TerminalShells = TerminalShells.fromJson(await fixture.callAsync("terminal.shells", null));
    context.skip(!shells.shells.some(t => t.id === "bash"), "bash is not installed.");
    const session: ToolSession = fixture.openToolSession(folder, OWNER);
    fixture.permissions.answerNext(PermissionDecision.AllowedOnce);
    const opened: unknown = await session.callAsync("terminal_open", { shell: "bash" });
    assert.ok(opened instanceof ToolResult, `The agent's open failed: ${JSON.stringify(opened)}`);
    const sessionId: string = String(opened.structured?.["terminal_id"]);
    const prompts = (): number => fixture.countMarks(sessionId, PROMPT_END_MARK);
    const drawn: number = prompts();
    const resizedAsync = async (): Promise<PermissionDecision> => {
      await fixture.callAsync("terminal.resize", { sessionId, size: { cols: 132, rows: 43 } });
      await fixture.waitForOutputAsync(`Terminal ${sessionId}'s prompt redrawn after the resize`, () => prompts() > drawn);
      return PermissionDecision.AllowedOnce;
    };
    fixture.permissions.answerNext(new Promise<PermissionDecision>((resolve, reject) => fixture.permissions.whenRaised(() => resizedAsync().then(resolve, reject))));

    const ran: unknown = await session.callAsync("terminal_run", { terminal_id: sessionId, command: "echo after-'resize'" });

    assert.ok(ran instanceof ToolResult && String(ran.structured?.["output"]).includes("after-resize"), `The agent's run failed: ${JSON.stringify(ran)}`);
    await fixture.callAsync("terminal.close", { sessionId });
    await fixture.part.deactivateAsync();
  });

  const promptShells: readonly (readonly [string, string])[] = IS_WINDOWS ? [["powershell", ""], ["git-bash", "\\w\\$ "]]
    : [["bash", "\\w\\$ "], ["zsh", "%~%# "]];
  for (const [shellId, prompt] of promptShells) {
    it(`[${shellId}] draws a Run's command on its prompt's row in a new ${shellId} terminal whose prompt is over 80 columns`,
      async context => {
      const home: string = join(folder, `${shellId}-home`);
      await mkdir(join(home, ".config", "git"), { recursive: true });
      await writeFile(join(home, ".config", "git", "git-prompt.sh"), `PS1='${prompt}'\n`);
      const fixture: RuntimeFixture = new RuntimeFixture(false, prompt === "" ? process.env
        : { ...process.env, PS1: prompt, ...shellId === "git-bash" ? { HOME: home } : {} });
      await fixture.part.activateAsync(fixture.context);
      const shells: TerminalShells = TerminalShells.fromJson(await fixture.callAsync("terminal.shells", null));
      context.skip(!shells.shells.some(t => t.id === shellId), `${shellId} is not installed.`);
      const runFolder: string = join(folder, `${shellId}-${"p".repeat(90)}`);
      await mkdir(runFolder, { recursive: true });
      const word: string = `ran-${randomUUID().slice(0, 8)}`;
      const pane: { cols: number; rows: number } = { cols: 200, rows: 30 };
      await fixture.callAsync("terminal.showOwner", { owner: OWNER });

      const running: Promise<JsonValue> = fixture.callAsync("terminal.run", { owner: OWNER, command: `echo ${word}`, folder: runFolder,
        shellKinds: [], shellId, size: { cols: 80, rows: 24 }, storedLimit: 104_857_600, sessionId: null, whenBusy: "Refuse", opensTab: true });
      await fixture.waitForEventsAsync("terminal.opened", 1);
      const sessionId: string = TerminalSummary.fromJson(fixture.published("terminal.opened")[0] ?? null).sessionId;
      await fixture.callAsync("terminal.resize", { sessionId, size: pane });
      await running;
      await fixture.waitForTextAsync(sessionId, `${word}\r\n`);
      await fixture.waitForOutputAsync(`Terminal ${sessionId}'s second prompt`, () => fixture.countMarks(sessionId, PROMPT_END_MARK) > 1);
      const attachment: TerminalAttachment = TerminalAttachment.fromJson(await fixture.callAsync("terminal.attach", { sessionId, paneId: "p1" }));
      const lines: readonly string[] = await drawAsync(attachment.snapshot, pane.cols, pane.rows);

      assert.ok(lines.some(t => new RegExp(`[$%#>] echo ${word}`, "u").test(t)), `The command was not drawn after its prompt:\n${lines.join("\n")}`);
      await fixture.callAsync("terminal.close", { sessionId });
      await fixture.part.deactivateAsync();
    });
  }

  it("ends an owner's agent terminals and unbinds its agent sessions when the app closes the owner, and not when the command line does",
    async () => {
    const fixture: RuntimeFixture = new RuntimeFixture();
    await fixture.part.activateAsync(fixture.context);
    const owners: object | undefined = fixture.context.services.get("terminal.owners");
    assert.ok(owners instanceof RuntimeTerminalOwners);
    const session: ToolSession = fixture.openToolSession(folder, null);
    owners.bindAgentSession("session-1", OWNER);
    assert.deepEqual(await fixture.listAsync(), []);
    const sessionId: string = await fixture.openAgentAsync(session);
    const pid: number = await fixture.readPidAsync(sessionId);

    await fixture.callAsync("terminal.closeOwner", { owner: OWNER }, ShellClients.commandLine, 2, null);
    const isRunningAfterCommandLine: boolean = ProcessState.isRunning(pid);
    await fixture.callAsync("terminal.closeOwner", { owner: OWNER });
    const next: string = await fixture.openAgentAsync(session);

    assert.equal(isRunningAfterCommandLine, true);
    assert.deepEqual(fixture.published("terminal.closed"), [{ sessionId }]);
    assert.deepEqual(fixture.channel("terminal.closed").targets, ["1/1"]);
    await vi.waitFor(() => assert.equal(ProcessState.isRunning(pid), false, `Shell process ${pid} is still running.`), { timeout: WAIT_MS, interval: POLL_MS });
    assert.notEqual(next, sessionId);
    assert.deepEqual(await fixture.listAsync(), []);
    await fixture.part.deactivateAsync();
  });

  it("leaves no shell process behind after it closes", async () => {
    const fixture: RuntimeFixture = new RuntimeFixture();
    await fixture.part.activateAsync(fixture.context);
    const sessionId: string = await fixture.openAsync(folder);
    const pid: number = await fixture.readPidAsync(sessionId);

    await fixture.callAsync("terminal.close", { sessionId });

    await vi.waitFor(() => assert.equal(ProcessState.isRunning(pid), false, `Shell process ${pid} is still running.`), { timeout: WAIT_MS, interval: POLL_MS });
    await fixture.part.deactivateAsync();
  });

  it("leaves no program its shell started behind after it closes", async () => {
    const fixture: RuntimeFixture = new RuntimeFixture();
    await fixture.part.activateAsync(fixture.context);
    let pid: number | null = null;
    try {
      const sessionId: string = await fixture.openAsync(folder);
      const childCommand: string = IS_WINDOWS
        ? "\"child=$((Start-Process ping -ArgumentList '-n','600','127.0.0.1' -NoNewWindow -PassThru).Id)\"\r"
        : "sleep 600 & echo child=$!\r";
      await fixture.typeAsync(sessionId, childCommand);
      const child: number = Number(await fixture.waitForMatchAsync(sessionId, /child=(\d+)/u));
      pid = child;
      assert.ok(ProcessState.isRunning(child), `Child process ${child} isn't running.`);

      await fixture.callAsync("terminal.close", { sessionId });

      await vi.waitFor(() => assert.equal(ProcessState.isRunning(child), false, `Child process ${child} is still running.`), { timeout: WAIT_MS, interval: POLL_MS });
    }
    finally {
      if (pid !== null && ProcessState.isRunning(pid))
        process.kill(pid);
      await fixture.part.deactivateAsync();
    }
  });

  it("leaves no program its shell started behind when it closes while the shell's prompt hooks run", async context => {
    context.skip(IS_WINDOWS, "The prompt hook is bash's PROMPT_COMMAND, and Windows' default shell is PowerShell.");
    const fixture: RuntimeFixture = new RuntimeFixture(false, { ...process.env, PROMPT_COMMAND: "sleep 0.3" });
    await fixture.part.activateAsync(fixture.context);
    let pid: number | null = null;
    try {
      const sessionId: string = await fixture.openAsync(folder);
      await fixture.typeAsync(sessionId, "sleep 600 & echo child=$!\r");
      const child: number = Number(await fixture.waitForMatchAsync(sessionId, /child=(\d+)/u));
      pid = child;

      await fixture.callAsync("terminal.close", { sessionId });

      await vi.waitFor(() => assert.equal(ProcessState.isRunning(child), false, `Child process ${child} is still running.`), { timeout: WAIT_MS, interval: POLL_MS });
    }
    finally {
      if (pid !== null && ProcessState.isRunning(pid))
        process.kill(pid);
      await fixture.part.deactivateAsync();
    }
  });
});
