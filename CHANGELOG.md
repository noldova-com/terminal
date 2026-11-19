# Changelog

**Scope:** What each published version of Terminal's packages holds, newest first.

Each version's section is written by the pull request that changes the version, from the pull requests merged since the previous version; other pull requests don't edit this file.

## 0.0.4

- The agent tools' reports name a terminal as its tab does: each report that holds the terminal's `title` also holds its `name`, the person's or the app's name for it or `null`, and its `shell_name`, the name of the shell it runs, such as PowerShell. Their output schemas list both. No report holds the title an app launched a terminal with (#105).
- Terminal needs Noldova Desktop 0.0.7 or later: the packages take `@noldova/desktop.protocol`, `@noldova/desktop.runtime` and `@noldova/desktop.window` at `>=0.0.7 <0.1.0`, and `module.json`'s `noldovaDesktop` is `>=0.0.7 <0.1.0` (#100).
- A shell's first completion of a command's options waits up to 3.5 seconds for the shell's answer, then 500 ms after that (#88).

## 0.0.3

- A link Ctrl+clicked in a terminal, Cmd+clicked on macOS, opens in the person's own browser by default, since sign-in links that tools print need the browser where they are signed in. The setting Open clicked links, `terminal.linkClick`, can open it in the app's browser instead (#92).
- Terminal needs Noldova Desktop 0.0.6 or later: the packages take `@noldova/desktop.protocol`, `@noldova/desktop.runtime` and `@noldova/desktop.window` at `>=0.0.6 <0.1.0`, and `module.json`'s `noldovaDesktop` is `>=0.0.6 <0.1.0` (#60, #74, #76, #82, #84).
- A terminal tab asks Noldova Desktop which dock holds it, and a tab moved into the bottom dock grows the dock to a launch's minimum rows (#54).
- On Windows, a key typed right after a resize is no longer lost while the pseudo console waits for the cursor's position (#80).
- An agent's prompt check reads a terminal as busy until the shell has read the person's keys, so an agent's run no longer types into a half-typed line (#49).
- A run into a new terminal waits up to 10 seconds for its pane's first fit, then starts the shell at the size it opened with (#62).
- A shell's first completion of a command's options waits up to 2 seconds for the shell's answer, then 500 ms after that (#58).
- On a machine with many PowerShell modules, the PowerShell lookup runs on past its time, so Windows PowerShell keeps its module scan and the next lookup is fast (#57).

## 0.0.2

- The packages are published through npm's trusted publishing, with provenance, so the release stores no token.

## 0.0.1

- The first version of `@noldova/terminal`, `@noldova/terminal.window` and `@noldova/terminal.protocol`, under the MIT License. The three packages move together.
- `@noldova/terminal` holds `module.json` and the runtime part, and exports `./runtime` and `./window`, which re-exports the window package.
- `./runtime` exports `RuntimePart`, `SystemRequirement`, `TerminalException` and `UnsupportedSystemException`; the `terminal.owners` service the runtime part publishes is no class of it, and a module reads it through `@noldova/terminal.protocol`'s `RuntimeTerminalOwners`.
- `@noldova/terminal.protocol` holds the messages the runtime and window parts exchange: `ProtocolReader` reads them through context's `JsonReader` and adds the protocol's limits and its refusal of unknown fields, and its `create` refuses a field a model's constructor refuses as a `JsonException` at the field's path; `ArgumentValidator` checks arguments, with a `find…Problem` form of each check that returns an `ArgumentProblem` instead of throwing.
- The protocol and the module take Noldova's `@noldova/context.exceptions` and `@noldova/context.json` as peers at `>=0.0.7 <0.1.0`, and the window package takes both as optional peers. Refusals are context's `ArgumentException` and `JsonException`.
- Each package has one base exception, which extends context's `Exception`: `TerminalProtocolException`, the runtime's `TerminalException`, and the window's `TerminalWindowException`, which `@noldova/terminal/window` re-exports.
- Each window tells the runtime which owner's terminals it shows, through `terminal.showOwner`, so a run's new terminal starts its shell at its pane's first fit, or at once when no window shows its owner.
- `TerminalSummary` carries `shellName` and `shellKind`, so a window names and marks a new tab from the terminal list.
