# Changelog

**Scope:** What each published version of Terminal's packages holds, newest first.

Each version's section is written by the pull request that changes the version, from the pull requests merged since the previous version; other pull requests don't edit this file.

## 0.0.6

- On Windows, a key typed into a shell right after a pane's resize is no longer lost while the pseudo console asks where the cursor is: keys typed after a resize wait for that request's answer, for at most 500 ms, and a resize the pseudo console sends no request after is logged (#202).
- A terminal brought back at a start in another shell or the home folder, because its shell wasn't found or its folder was missing, keeps its saved shell and folder, so a later start brings them back: a WSL distribution after a slow listing, or a folder on a disk not yet mounted. Its folder moves again once its own shell reports another folder than the one it started in (#206).
- On macOS, a login pwsh starts through zsh as a login sh, which runs `/etc/profile` and `~/.profile` once, so pwsh no longer ends at once with `Call to 'procargs' failed with errno 5` (#195).
- Terminal needs context's packages 0.0.12 or later and `@noldova/ui.components.angular` 0.0.25 or later: the packages take `@noldova/context.exceptions` and `@noldova/context.json` at `>=0.0.12 <0.1.0`, and the kit at `>=0.0.25 <0.1.0` (#198, #187).

## 0.0.5

- On Windows, a key typed into Git Bash while the pseudo console's cursor request after a resize waits for its answer is no longer lost: it goes in behind the resize wake-up's Ctrl+G (#189).
- `terminal.run` types an app's commands only into a terminal in the run's folder, so after an owner's folder changes, the next run no longer goes into a terminal left in the old one (#181).
- A run waits for the shell to draw its next prompt before it takes or refuses a terminal, so a run sent right after another's end no longer gets `Busy` from a terminal that refuses when busy, or a second shell (#148).
- A run sent while its owner's or connection's terminals close answers `Ended` and types nothing, and closing an owner or a connection waits only for its own opens and runs (#150, #138).
- An agent's command started before a shared terminal's restart ends as `Killed` at the restart, and an interrupt sends nothing to the new shell (#134).
- On Linux and macOS, Ctrl+C waits for bash's or zsh's copy of the shell to start the command, so an interrupt sent at once is no longer lost (#152).
- Keys and pastes typed into a pane while it attaches reach the shell (#119), and an exit or restart that arrives while a pane draws its attach shows after the draw (#151).
- A pane that a reload or a closed window left behind no longer pauses its shell (#120).
- Bracketed paste and the key modes stay on while a pane shows stored lines (#156), and command coloring looks commands up again once a pane attaches after a failed lookup (#153).
- A completion answers from the last finished environment read on Windows and never waits for a new one (#140).
- Completion candidates and items are kept to printable text, so a completion can't type control characters into the shell (GHSA-gf3c-9f8g-gfc3).
- Terminal needs Noldova Desktop 0.0.11 or later, context's packages 0.0.10 or later and `@noldova/ui.components.angular` 0.0.24 or later: the packages take `@noldova/desktop.protocol`, `@noldova/desktop.runtime` and `@noldova/desktop.window` at `>=0.0.11 <0.1.0`, `@noldova/context.exceptions` and `@noldova/context.json` at `>=0.0.10 <0.1.0`, and the kit at `>=0.0.24 <0.1.0`, and `module.json`'s `noldovaDesktop` is `>=0.0.11 <0.1.0`.

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
