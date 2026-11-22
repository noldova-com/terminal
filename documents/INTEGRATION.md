# Adding the terminal module to an app

This guide says how an app on Noldova Desktop adds the terminal module and what it needs.
[ARCHITECTURE.md](ARCHITECTURE.md) describes the module's parts.

## Where it stands

- The module ships as the npm package `@noldova/terminal`, with `module.json` and its runtime part.
  It pins its window part's package, `@noldova/terminal.window`, and its protocol's, `@noldova/terminal.protocol`, at its own version ([ARCHITECTURE.md](ARCHITECTURE.md#the-package)).
- What works today, and CI checks on Linux x64, Windows x64 and macOS arm64 and, on pushes to `main`, on macOS x64: the three packed packages install into an app, and the runtime part activates from the installed files and opens a terminal.
- The shells start and end through Noldova Desktop's pseudo-terminals, with the module's own node-pty, so an app's runtime records them and ends what they leave running ([ARCHITECTURE.md](ARCHITECTURE.md#ending-a-shell)).
- The agent tools register with Noldova Desktop's tool registry, and raise their permission requests through Noldova Desktop's permission contract: an app answers them with its permissions module's answerer, and without one every request is denied and only `terminal_list` works ([ARCHITECTURE.md](ARCHITECTURE.md#the-permission-request)).

## Pinning and listing the module

An app pins the module's package exactly in its root `package.json` and lists it in `desktop.modules` as a module from a package, as Noldova Desktop's `documents/MODULES.md` ("Modules from packages") says:

```json
{
  "dependencies": {
    "@noldova/terminal": "0.0.6"
  },
  "desktop": {
    "modules": [
      { "id": "terminal", "package": "@noldova/terminal" }
    ]
  }
}
```

- The module accepts Noldova Desktop from 0.0.7, the version it builds and tests with, up to 0.1.0, its `module.json`'s `noldovaDesktop`, `>=0.0.7 <0.1.0`, so an app moves to a Noldova Desktop release that doesn't break modules without a Terminal release.
- The package takes `@noldova/desktop.runtime` and `@noldova/desktop.protocol` as peers at that range, which the app's own install of Noldova Desktop meets.
- The package and `@noldova/terminal.protocol` both take context's `@noldova/context.exceptions` and `@noldova/context.json` as peers at `>=0.0.7 <0.1.0`: the protocol reads its messages through context's `JsonReader` and throws context's `ArgumentException` and `JsonException`, so an app catches those from context's packages.
  An app whose install pins an earlier context version moves it to 0.0.7 or later in the same change that takes this Terminal version.
- The window part's package takes the app's packages its compiled part imports as optional peers: `@angular/core` at `>=22.3.0 <23.0.0`, from the Angular the part builds with to the next major, `@noldova/desktop.protocol` and `@noldova/desktop.window` at `>=0.0.7 <0.1.0`, `@noldova/ui.components.angular` at `>=0.0.9 <0.1.0`, and `@noldova/context.exceptions` at `>=0.0.7 <0.1.0`, since its exceptions extend context's `Exception` and it throws context's `ArgumentException`.
  Its other context packages are only types in its compiled part, so it names them only where its declarations import them.
  The app's window workspace holds them, and Noldova Desktop's build installs the window part's package there.
  An app whose window workspace pins an earlier kit moves it to 0.0.9 or later first, in the same change that takes this Terminal version or before it: the window part draws its completion list with the kit's `nol-completion-list`, which 0.0.9 adds, and npm refuses the window part's package against an earlier pin.
- The app's window workspace pins `@angular/common` and `@angular/forms` at 22.3.0 itself, as it pins its other Angular packages.
  `@angular/cdk` 22.3.0, which `@noldova/desktop.window` takes, accepts any 22 or 23 release of them, so without the pins npm installs the newest 22 release, whose own exact peer on `@angular/core` conflicts with 22.3.0, and the install stops with ERESOLVE.
  The window part's peers can't settle this, since npm settles the cdk's range before them, and Noldova Desktop's own window package does the same installed alone; Noldova Desktop's `documents/BUILD.md` makes these pins the app's job.
- The packages come from npm.

## What the person's computer needs

| System | Minimum |
|---|---|
| Windows | Windows 10 version 1809, build 17763, on x64 |
| Linux | glibc 2.28, on x64 |
| macOS | Intel or Apple silicon |

On a system below its minimum, the runtime part doesn't start: it writes the reason to the module's log and its activation fails with that reason.

The module runs elevated and not elevated on Windows.

## Its native dependency

The runtime part runs shells through `node-pty` at an exact version, which ships prebuilt binaries for all six targets.

- An app's install doesn't need node-pty's install scripts: `npm install --ignore-scripts` leaves a working module, and CI installs it that way.
  With scripts on, node-pty's `install` script checks that a prebuild exists for the target and compiles from source only when none does, and its `postinstall` copies the Windows pseudo console's files next to a local build.
- A packaged app keeps node-pty's files unpacked, since a native addon and its helper programs can't load from inside an archive: Noldova Desktop's packaging unpacks every native file of the target, node-pty's `conpty.dll` and `OpenConsole.exe` on Windows and its `spawn-helper` on macOS among them; it leaves out the prebuilds and ConPTY builds of other targets, but a native file of another platform that a package ships stays, such as node-pty's macOS `spawn-helper` in a Linux package, as its BUILD.md, Layout, says.

## Activating the runtime part

Noldova Desktop activates the runtime part with its context, and the app doesn't call it itself.

```ts
import { RuntimePart } from "@noldova/terminal/runtime";

const part = new RuntimePart();
await part.activateAsync(context);
// ...
await part.deactivateAsync();
```

- Activation registers the `terminal.*` methods, declares the `terminal.*` events that `module.json` lists, and publishes the service `terminal.owners` ([Terminals tied to the app's own things](#terminals-tied-to-the-apps-own-things)).
- Deactivation ends every shell, and calling it again does nothing.
- The module's settings are on Settings' Terminal page: Default shell, `terminal.defaultShell`, for this device, where empty leaves the shell to the runtime's default, Output kept per terminal, `terminal.outputLimit`, in MB from 10 to 10,000, 100 by default, Font size, `terminal.fontSize`, for this device, in pixels from 8 to 32, 13 by default, which sizes every terminal; no text size under Appearance changes it, Suggest earlier commands, `terminal.suggestions`, on by default ([ARCHITECTURE.md](ARCHITECTURE.md#earlier-commands)), Color typed commands, `terminal.commandColors`, off by default ([ARCHITECTURE.md](ARCHITECTURE.md#command-colors)), Complete with a list, `terminal.completionList`, on by default ([ARCHITECTURE.md](ARCHITECTURE.md#completion-list)), and Open clicked links, `terminal.linkClick`, In your browser by default, or In the app's browser, whatever the app's Links settings say.
  Default shell and Output kept per terminal apply to terminals opened afterwards; Suggest earlier commands applies at once in the window, and leaves PowerShell's own predictions to the person's profile.

## Where new terminals start

A new terminal starts in the person's home folder unless the app gives the folder.
The app's window part provides it with `TerminalStartFolder`, and the terminal asks for it each time it opens a terminal without a folder of its own, so the folder is never stale:

```ts
import { TerminalStartFolder } from "@noldova/terminal/window";

const unregister = TerminalStartFolder.provide(context, () => project.folder);
// ...
unregister();
```

- A window takes one provider, and a second `provide` throws until the first is removed.
- The provider gives an absolute folder, or `null` for the home folder.
  A blank, relative or over-long folder, or a provider that throws, opens the home folder instead, and the app's own log says so.
- `terminal.new` takes optional arguments, so the app's own menus can open a terminal somewhere specific: `{ folder, shellId, tabGroup, owner }`, where a given folder wins over the provider's, `shellId` is one of `terminal.shells`' ids and `tabGroup` the id of the tab group to open the tab in, as Noldova Desktop gives it to the tab row's buttons.
  A `null` or absent `folder` opens the start folder, a `null` or absent `shellId` the default shell, and a `null` or absent `tabGroup` the group Noldova Desktop chooses.
  It refuses a relative folder, a blank shell or tab group, or another field.
- The runtime refuses a folder that is absolute only on another platform, such as `C:\work` on Linux or `/work` on Windows.
- A folder that no longer exists opens the terminal in the home folder: the module's log says so, and the terminal's first line says so in dim italics, above the shell's first prompt.

## Terminals tied to the app's own things

An app can tie a terminal to something of its own, such as a chat, with an owner: a string of 1 to 256 characters it chooses, starting with its module's id, such as `example.chat/42`.
A window shows the terminals without an owner and one owner's at a time; the others' tabs close, their shells keep running, and their output keeps being kept.
The app's window part provides the window's owners, and shows its current owner after each activation, since a reload shows none:

```ts
import { TerminalOwners } from "@noldova/terminal/window";

const owners = TerminalOwners.provide(context, () => settings.chatTerminals ? `example.chat/${chat.id}` : null);
await owners.showAsync(`example.chat/${chat.id}`);
// The person switches to another chat:
await owners.showAsync(`example.chat/${other.id}`);
// The chat is deleted:
await owners.closeAsync(`example.chat/${chat.id}`);
// ...
await owners.removeAsync();
```

- A window takes one provider, and a second `provide` throws `OwnersProvidedException` until the first is removed.
- The function gives the owner a terminal from Terminal's own + and Toggle Terminal's first open take, or `null` for none; Terminal asks it at each open.
  A blank or over-long owner, or a function that throws, opens a terminal without an owner, and the app's own log says so.
  The function gives the owner the window shows: a terminal for another opens without a tab, so the person sees nothing open, and the app's own log says so.
- The shell menu's rows, Ctrl+Shift+\` and the View menu always open a terminal without an owner.
  The app's own entry opens one for an owner by running `terminal.new` with `{ owner, tabGroup }`; a terminal for an owner the window doesn't show opens without a tab until its owner shows.
- `showAsync(null)` hides every owned terminal.
- `closeAsync(owner)` ends the owner's terminals in every window, as closing their tabs does, and forgets them for the next run.
  The app's runtime part does the same with no window open through the runtime service `terminal.owners`, which needs `terminal` among its module's dependencies.
  It reads the service with `RuntimeTerminalOwners` from `@noldova/terminal.protocol`, a peer at Terminal's exact version, so its install needs neither `@noldova/terminal` nor the window package's Angular peers.
  The check holds only while the app and Terminal install one copy of the protocol package; with a second copy, such as one at another version, `getService` throws a `PackageCopiesException` that says so:

```ts
import { RuntimeTerminalOwners } from "@noldova/terminal.protocol";

await context.getService("terminal.owners", RuntimeTerminalOwners).closeAsync(`example.chat/${chat.id}`);
```

- An agent's terminal belongs to its chat when the app binds the agent session to the chat's owner as it opens the session, with the binding `terminal.owner` ([Agent permissions](#agent-permissions)), or before the agent runs with `bindAgentSession(agentSessionId, owner)` on the same service, which takes over the binding until `unbindAgentSession(agentSessionId)` unties it; that one goes when the session ends.
  The agent's terminals then show, hide and close with the chat, the person types into them and closes them, and they stay open after the agent's turn; every agent session bound to the same owner reaches them too, the chat's next one and one running at the same time.
  Closing the owner unbinds the sessions `bindAgentSession` bound, so an agent's terminal they open after the close has no owner and closes with its session; a session's `terminal.owner` binding stays for its life.
  So when the owner goes away, such as a deleted chat, the app ends the owner's agent sessions first and closes the owner after: an agent's open between the close and the session's end would make a terminal of the closed owner, which no window shows. Bind with `bindAgentSession` before the session's first call, since a binding made after the session ended stays until `unbindAgentSession`.

```ts
const owners = context.getService("terminal.owners", RuntimeTerminalOwners);
owners.bindAgentSession(agentSessionId, `example.chat/${chat.id}`);
```

- The app adds its own entries to the tab row's new-terminal menus with groups in Terminal's places `terminal.tabRow`, after + and the shell menu, and `terminal.shellMenu`, after the shells, as Noldova Desktop's `documents/MODULES.md` ("Menus and toolbars") describes; each item runs one of the app's own commands, which gets the row's `tabGroup`.

### Running commands in an owner's terminal

When the person runs commands from the app's own content, such as a shell code block in a chat's reply, the app runs them in a terminal of the owner with `runAsync(owner, command, folder, shellKinds)`.
It runs them only when the person asks, such as with a Run button, and shows the owner first:

```ts
import { TerminalOwners, TerminalShellKind } from "@noldova/terminal/window";

const owner = `example.chat/${chat.id}`;
if (TerminalOwners.canRun(block.text)) {
  await owners.showAsync(owner);
  const sessionId = await owners.runAsync(owner, block.text, chat.folder, [TerminalShellKind.Bash, TerminalShellKind.Zsh]);
}
```

- The runtime types the commands into the owner's newest free terminal of one of the kinds, and an empty list of kinds takes any.
  It takes only a terminal in the run's folder: the folder its shell last reported, with Git Bash's `/c/...` read as the Windows folder it names, or its start folder while its shell reported no absolute one, and none for a Git Bash report outside the drives such as `/usr/bin`, compared as the file system resolves both, within a second each or else as written, without a trailing separator and, on Windows, without case or the slashes' direction; a folder that no longer exists counts as the home folder a run for it starts in, and a run with a `null` folder takes any.
  A terminal is free when it is a person's terminal, not an agent's, its shell runs and has the shell integration, and it is at its prompt with nothing typed after it and no keys within the last second.
  A shell without the integration can't be told free, so each run there opens a new terminal.
  Command Prompt is such a shell by design, so each run with `[CommandPrompt]` opens a new terminal: telling an idle one from a busy one would need marks in its prompt, which would hand the programs it runs the integration's nonce ([ARCHITECTURE.md](ARCHITECTURE.md#running-an-apps-commands)).
- A run's end comes at its command's end, before the shell draws its next prompt. So when the owner's newest such terminal is still drawing its prompt, as right after the last run's end, the runtime waits up to 10 seconds for the prompt, holding the terminal as a run that is starting, and types there once it is free; the wait ends when the terminal closes. Otherwise, or when it isn't free after the wait, the run takes the newest free terminal. While the owner's terminals or the connection's are closing, a run that names none types nothing and answers `Ended` naming the newest of them. When there is none yet, as while the owner's only terminal is still opening, a run caught by its owner's close waits for the close to end and then runs as usual, in a new terminal, and a run whose own connection is closing fails at once and opens nothing, since no one is left to get its answer.
- With no free terminal, it opens one for the owner in the folder, or the app's start folder for `null`, else the home folder, which also stands in for a folder that no longer exists.
  The new terminal runs the Default shell setting's shell when it is of the kinds or the list is empty, else the first installed shell of the kinds, and the commands are typed once its shell is ready.
  With no shell of the kinds installed, nothing opens and nothing is typed, since a shell of another kind would read the commands differently: `runAsync` throws `RunShellKindsMissingException`, a `TerminalRunRefusedException` for `shellKinds`, with a message an app can show that names the kinds, such as "The commands weren't run, and nothing opened: no shell of the kinds they need is installed (Bash or Zsh)."
- The commands go in as a paste would type them: inside a bracketed paste when the shell asked for one, so several lines run as their paste would, then Enter once; blank lines at their start and line breaks at their end are dropped, so the first command stays on the prompt's line, which a pasted line break would leave empty in a shell that takes bracketed pastes.
  Their typing counts as the person's keys, so a second run within a second opens another terminal rather than joining the first's line.
- They go in only if nothing was typed into the terminal since the run picked it, and, for a shell with the integration, onto an empty prompt line, so keys the person typed meanwhile never run with them.
  A shell without bracketed paste, such as Command Prompt, takes a tab as completion, so commands holding a tab aren't typed there.
- `runAsync` resolves with the terminal's session id once the commands are typed; a new terminal's tab opens only after that, so the person can't type into it first.
- While the window shows the owner, the terminal's tab shows and its pane takes the focus, as a new terminal's does, unless the person moved the focus elsewhere meanwhile; a terminal of an owner the window doesn't show gets its tab when that owner shows.
- It throws a `TerminalRunRefusedException` before anything opens or is typed, naming in `parameter` the refused field, as one subclass per refusal: `RunArgumentRefusedException` for `owner`, `command`, `folder` or a kind such as `shellKinds.1`, with the validator's `reason`; `RunShellKindsMissingException` for `shellKinds` when no shell of the kinds is installed; or `RunPartInactiveException` for `context` while Terminal's window part isn't active.
- It throws `TerminalRunNotTypedException` once the terminal's tab shows, when the runtime picked or opened a terminal but typed nothing, with the terminal's `sessionId` and a `TerminalRunOutcome` as `reason`: `Input` for keys typed meanwhile or text on the prompt line, `Tab` for a tab without bracketed paste, `Ended` for a terminal that ended, closed or restarted first.
- `TerminalOwners.canRun(command)` says whether `runAsync` takes the commands: not blank, at most `TerminalOwners.maximumCommandLength`, 16,384 UTF-16 code units, no control character but line breaks and tabs, and no format or default-ignorable character (Unicode category Cf or property Default_Ignorable_Code_Point) outside an emoji, such as a bidirectional mark, a zero-width character, a variation selector or a tag character, which would make a code block read differently from what runs.
  Terminal never logs the commands, and a refusal never holds them.

### Running commands in a given terminal, and reading what a run printed

An app that shows a terminal itself, such as one under a chat's code blocks ([Showing a terminal in the app's own page](#showing-a-terminal-in-the-apps-own-page)), keeps running into that terminal with `startRunAsync(owner, command, folder, shellKinds, target)`, and reads back what each run printed with `readRunOutputAsync(run, maximumLines)`:

```ts
import { TerminalOwners, TerminalRunBusy, TerminalRunNotTypedException, TerminalRunOutcome, TerminalRunTarget } from "@noldova/terminal/window";

try {
  const run = await owners.startRunAsync(owner, block.text, chat.folder, kinds, new TerminalRunTarget(chat.sessionId, TerminalRunBusy.Refuse));
  block.run = run;
}
catch (error) {
  if (error instanceof TerminalRunNotTypedException && error.reason === TerminalRunOutcome.Busy)
    block.askStopOrNew = true;
}
// Once the next block's run starts:
const output = await owners.readRunOutputAsync(block.run);
```

- `startRunAsync` with a `null` target is `runAsync`, and gives the run instead of the session id.
- With a target, the commands go only into that terminal, which is a person's terminal of the owner, of one of the kinds, that the window reaches; for any other, alike whether it doesn't exist, closed or isn't the owner's, nothing is typed and the run throws `TerminalRunNotTypedException` with the reason `Ended`, so the app runs the commands in a new terminal.
  No tab opens or shows for it, since the app shows the terminal.
- A target still drawing its prompt, as right after the last run's end, is waited for first, up to 10 seconds, held as a run that is starting, and the wait ends when the terminal closes. A target whose owner's terminals or connection's are closing answers `Ended` at once and types nothing.
  A target whose shell is then busy, running a command or with text on its prompt line, gets nothing typed: with `TerminalRunBusy.Refuse` the run throws `TerminalRunNotTypedException` with the reason `Busy` at once, and with `TerminalRunBusy.Interrupt` Terminal waits up to two seconds for a command to start, sends it Ctrl+C, waits up to two seconds more for the shell to be back at an empty prompt, then types, or throws with `Busy` when it isn't; a line that doesn't start, such as one the person is still typing, gets no Ctrl+C.
  A shell without the integration can't be told free, so a run into it is always busy.
  A run that comes while another run into the same target is still starting is busy too, so two Runs at once never type into each other's line.
- An app that shows the run's terminal in its own pane, as a chat does under its code blocks, passes `shown`, `startRunAsync(owner, command, folder, shellKinds, target, shown)`, so no tab opens or takes the focus, for a new terminal or a free one the run reuses, now or when the owner shows; the person's typing stays where it is.
  `shown` gets the terminal's session id before anything is typed, so the app attaches its pane then: a new terminal's shell starts at that pane's first fit and draws the commands at its width, or at 80 columns once the window closes or detaches the pane before it fits, or once the pane hasn't fit within 10 seconds.
  The terminal stays in the window's terminal list and the agents' tools, and its tab opens only when the person opens it.
  A window's runs with `shown` start one at a time.

  ```ts
  const run = await owners.startRunAsync(owner, block.text, chat.folder, kinds, null, sessionId => chat.showTerminal(sessionId));
  ```
- `TerminalRun` holds the terminal's `sessionId`, the run's `runId`, and `ended`, which resolves once with a `TerminalRunEnd` when the run's commands have ended, and never rejects:
  - `"Command"` when the shell's integration marked the end of the run's last command, with that command's `exitCode`, or `null` when the shell gave none, as a bash before 4.4 with `promptvars` off doesn't for a subshell such as `(exit 3)`; a Ctrl+C, from `Interrupt` or from the person, ends a command like any other.
  - `"NoIntegration"` when the shell has no integration to mark it, such as Command Prompt, fish or WSL; it has already resolved when `startRunAsync` resolves, so an app never shows such a run as running.
    The integration marks that it loaded before the person's startup files run, so a slow profile only delays the run. A new terminal's shell that sent no such mark within 10 seconds, as when its integration failed to load, counts as having none: the run is typed then and ends this way, and the shell's later marks don't change it, though its commands may still run.
  - `"TerminalEnded"` when the terminal's shell exited or restarted, the terminal closed, or the runtime started again first.

  A run's `ended` has resolved before a later run the window starts into the same terminal resolves `startRunAsync`, since Terminal ends a run still waiting before it types the next.
  A run of several lines ends with its last line's command; in a shell that takes no bracketed paste, such as macOS's bash 3.2, a command that goes on over several lines marks one end for them all, so its run ends as the next run is typed or the terminal ends.

  ```ts
  const end = await run.ended;
  block.state = end.endedBy === "NoIntegration" ? "idle" : "ended";
  block.exitCode = end.exitCode;
  ```
- `readRunOutputAsync` gives the run's lines from the prompt where its commands were typed up to the prompt where the next run into the same terminal typed its own, or up to the cursor's line for the latest run, so the commands the person typed in between, and their output, are in it.
  It gives the last `maximumLines` of them, 2,000 unless asked, at most `TerminalOwners.maximumRunLines`, 5,000, each from its start, and `cutLines` counts the earlier ones cut by the limit or no longer on the terminal's screen and in its scrollback, the last 1,000 lines above the screen, such as older lines or ones the shell erased, as `clear` does.
  Each `TerminalLine` has its `text` and its `runs` of colors and styles: a color is `TerminalOwners.defaultColor`, a palette index from 0 to 255, or an RGB color `0xRRGGBB` offset by `TerminalOwners.rgbColor`, and a style is a sum of `TerminalTextStyle` flags.
- It throws `TerminalRunNotFoundException` for a run whose output Terminal can't give, or whose ids it refuses: one its terminal no longer keeps, as it keeps the latest 100 runs of each, one whose shell ended or restarted, or one whose terminal Terminal no longer has, such as after its runtime started again; so an app reads a run's output as soon as it wants to keep it, such as when the next run starts.
  Other `maximumLines` throw a `RunLinesRefusedException`, which names the number and the limit.
- Only the app reads a run's output, and only from the person's terminals: no agent's tool reads it.

### Showing a terminal in the app's own page

An app can show a live terminal inside its own page, such as under the code block whose commands ran in it, with `EmbeddedTerminal`:

```ts
import { EmbeddedTerminal } from "@noldova/terminal/window";

const embedded = EmbeddedTerminal.open(sessionId, environmentInjector, 15);
host.append(embedded.element);
embedded.focus();
// Later, under another block:
otherHost.append(embedded.element);
// When the app no longer shows it:
embedded.dispose();
```

- It is Terminal's own pane for the session, with its keys, links, look and snapshot, so the person types into the shell there as in a terminal tab; the session stays open when the app disposes of its element.
- Its shell gets the element's width in columns and the rows the app asks for, from 1 to 1,000; other rows throw an `EmbeddedRowsRefusedException`.
  The element is only as tall as the rows drawn so far, from the screen's top to the cursor's row, up to those rows, and its terminal scrolls once they fill; `rows` gives how many it shows.
  `setMaximumRows(rows)` changes them, such as when the app's page changes height; fewer rows than are drawn shrink the element, and its terminal scrolls inside.
  While a full-screen program, such as an editor, has the alternate screen, it shows all of them, and `isFullScreen` is `true`.
- `rowHeight` gives a row's height in CSS pixels, 0 until the pane has shown, and follows the pane as it draws or resizes, such as when the font size changes.
  The element is taller than its rows by its inset, so an app counts the rows its page has room for from `rowHeight`, never from the element's height divided by `rows`, which overstates a row; each change of `setMaximumRows` resizes the shell, and an idle shell, such as Git Bash on Windows, may redraw over the person's next key.
- It takes the focus only when the app calls `focus()`, and, called while its terminal still loads or while it is hidden, once it shows with its terminal; it never takes the focus as it opens, so typing elsewhere never goes into its shell.
- The app moves `element` between hosts as it likes, without the session reopening.
  `setShown(false)` stops its drawing, such as while the app keeps it out of its page, and `setShown(true)` draws it again; an element the app takes out of its page without `setShown(false)` still counts as shown, so it keeps sizing the shell, and a terminal tab of the session draws at its size until the person focuses the tab.
- `hasEnded` turns `true` when the session's shell ends; the element keeps its last screen and takes no typing.
- One shell has one size, so within a window one shown pane of the session sizes it, the element or a terminal tab or panel of the session: the one the person focused or typed in last, else the one opened last; a pane that opens takes the size from no pane the person has focused, even once the focus has left it, so the element opening, or opening again as the app shows its page again, never resizes a terminal the person typed in, and takes the size once the app calls `focus()`.
  The others draw at that size, clipped, or with blank space to their end; when a taller pane sizes it and more rows are drawn than the element shows, the element shows the last of them.
  A pane that shows again sizes the shell once it is focused, or once the sizing pane hides or goes, so a terminal tab never stays at the element's size after the element goes.
  Panes in different windows each size the shell when they change, as before.
- The injector is the app's `EnvironmentInjector`, which gives the window's services, such as its clipboard.
  It throws `TerminalNotActiveException` while Terminal's window part isn't active in the window.

## Terminals the app launches

An app can open a terminal of its own for the person, such as one to sign in to a tool: with variables laid over the shell's environment, a notice above the shell's first output, and a promise of how its shell ended.
Nothing runs without the person: the notice says what to run, and nothing is typed into the shell.

```ts
import { TerminalLaunch, TerminalLauncher, TerminalLaunchRefusedException } from "@noldova/terminal/window";

const launched = await TerminalLauncher.openAsync(context, new TerminalLaunch(project.folder, { AGENT_HOME: agentHome },
  "Run `agent login` to sign in, then close this terminal.", "Sign in"));
const end = await launched.ended;
// end.endedBy is "Exit", "Close" or "Detach", and end.exitCode the shell's exit code or null.
```

- `context` is the calling part's own; the app's module needs `terminal` among its dependencies.
  The terminal's own window part opens the tab, and refuses every launch while it isn't active.
- The folder is absolute, or `null` for the start folder the app provides, else the home folder.
  A folder that no longer exists is refused and never replaced with another, so nothing opens.
- The variables lie over the environment the shell starts from, and under the shell integration's own; on Windows a variable replaces the one whose name matches in any case.
  Each name is portable: a letter or `_`, then letters, digits or `_`, at most 256 characters, and no two names differ only in case.
  A launch takes at most 256 variables, each value at most 32,767 characters without a null character, and at most 131,072 characters of names and values in all, which leaves room for the environment they lie over within what a program's start takes on macOS and Linux.
- These names are the terminal's own, in any case, and are refused: `TERM` and `COLORTERM`, which say what the terminal draws; `ZDOTDIR`, which the zsh integration sets; and every name that starts with `NOLDOVA_TERMINAL_`, which the shell integration uses.
- The values are never logged, saved or restored.
  The runtime holds them in memory only while the terminal is open, so that a Restart from its tab starts the shell with them again.
- The notice is at most 4,096 characters, and its line breaks start new lines; the runtime shows it dim and italic, as its own lines, with control characters replaced.
- The title is the tab's, at most 200 characters, else the shell's name.
  It isn't stored, so after a reload the tab shows the shell's name.
- `launched.closeAsync()` ends the terminal as closing its tab does, as when the app stops what the terminal was for, such as a sign-in the person cancels: its tab closes, its shell ends, and `ended` resolves `Close`.
  It resolves once the tab has closed, and does nothing for a terminal that already ended; a second call while the first is under way waits for the first, and a terminal the person closed meanwhile counts as closed.
- The command, the launch's fifth argument, is typed into the shell and entered once the shell is ready, as if the person typed it: the tab shows it, and its output follows.
  It is one line of at most 16,384 characters, with no line break, tab or other control character.
  The shell runs it as the person's own command, so pass only a command the app means the person to run, such as a provider's official installer.
  A Restart doesn't type it again.
- `commandEnded` resolves once with the launch's command's exit code when that command ends, while the terminal stays open, so the app can act on a sign-in or an install as soon as it finishes; commands the person types after it don't count.
  It resolves `null` when the launch has no command, when the terminal ends first, when the shell has no integration (Command Prompt, fish, WSL) or never took the command, when the person typed into the terminal before the command went in, when a Restart comes first, or when the shell gave no code or marked no end for it, as a bash before 4.4 with `promptvars` off doesn't for a subshell such as `(exit 3)`; it never rejects, and `ended` is unchanged.

  ```ts
  const launched = await TerminalLauncher.openAsync(context, new TerminalLaunch(null, {}, null, "Sign in", "tool auth login"));
  const exitCode = await launched.commandEnded;
  if (exitCode === 0)
    await launched.closeAsync();
  ```
- The launch's sixth argument, `opensTab`, is `false` for a terminal the app shows only in its own page, such as a sign-in under a provider's row: no tab opens, the app passes the launched terminal's `sessionId` to `EmbeddedTerminal.open`, and the terminal runs and ends as a tabbed one does, so `closeAsync` ends it.
  The runtime lists it without a tab, so a window that opens again doesn't give it one either.
  The runtime ends it when the window that launched it closes or reloads, as the app's connection closing ends every launched terminal, and the app closes it with `closeAsync` once it no longer shows it.
- The minimum rows, the launch's seventh argument, is a whole number from 1 to 100: the tab shows at least that many rows while the terminal is open, for a program that draws more than a short dock shows, such as a sign-in's list.
  As the tab first shows in the bottom dock, which the window part learns from Noldova Desktop's `viewDockOf`, also when the person moves the tab there later, the dock grows by what the terminal lacks, as far as the window allows, through Noldova Desktop's `growViewDock`; when the terminal ends or closes, the dock goes back to its size, unless the person resized it meanwhile.
  A tab in a side dock grows nothing, since Noldova Desktop grows a side dock's width, which gives the terminal no rows, and a tab in the middle area grows nothing either.
  A launch without a tab can't ask for minimum rows, since the embedded terminal takes its rows from `EmbeddedTerminal.open`.
- The shell kinds, the launch's eighth argument, limit the shell the terminal runs, as a run's kinds do: the Default shell setting's shell when it is of them, else the runtime's default when it is, else the first installed shell of them.
  An app whose program the person installed on the host asks for the host's own shells, such as `[TerminalShellKind.PowerShell, TerminalShellKind.CommandPrompt]` on Windows, so a WSL distribution set as the Default shell doesn't run its sign-in, where the program isn't found.
  With none of them installed, nothing opens and `openAsync` rejects; no kinds, the default, means any shell.
- `openAsync` throws a `TerminalLaunchRefusedException` before anything opens when it refuses the folder, a variable, the notice, the title, the command, the minimum rows or a shell kind; its `parameter` names the field, such as `environment.TERM`, and neither it nor the message ever holds a variable's value.
  Each refusal is its own subclass: `LaunchArgumentRefusedException` for a field the validator refuses, with its `reason`; `LaunchTitleRefusedException`, `LaunchRowsRefusedException` and `LaunchRowsWithoutTabException` for the title and the minimum rows; `LaunchFolderMissingException`, with the `folder`, for a folder that no longer exists; and `LaunchPartInactiveException` while Terminal's window part isn't active.
  A launch the runtime fails rejects with the runtime's failure.
- The terminal has a tab like the person's own, without an owner, and isn't the panel's; it isn't kept for the next run, so a new start of the app doesn't open it again.
- `ended` resolves once, at the terminal's end, and never rejects: `Exit` when the shell exited by itself, with its exit code; `Close` when the person closed the tab, whether or not its shell ended; `Detach`, with no exit code, when the runtime started again, which opens no launched terminal again.
  A Restart of a running shell doesn't end it: the tab stays, and the new shell takes the same variables. Only a Restart whose new shell fails to start ends it, with `Close`. A Restart after the shell exited starts it again, but `ended` has already resolved.

## Agent permissions

Each command an agent runs raises a permission request through the runtime's permission contract.
The app binds to each agent session, as it opens it, the session's working folder as `terminal.folder`, an absolute path, the terminals the person shared with it as `terminal.shared`, a list of terminal ids, and, when the session's terminals belong to something of the app's, their owner as `terminal.owner` ([Terminals tied to the app's own things](#terminals-tied-to-the-apps-own-things)):

```ts
const session = context.tools.openSession("example.chat", {
  "terminal.folder": workingFolder,
  "terminal.shared": sharedTerminalIds,
  "terminal.owner": `example.chat/${chat.id}`
});
```

The app owns the permission card and the policy that decides whether the person is asked; the module only says what each request would allow and at what risk, as [ARCHITECTURE.md](ARCHITECTURE.md#the-agent-tools) lists.
