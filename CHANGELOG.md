# Changelog

**Scope:** What each published version of Terminal's packages holds, newest first.

Each version's section is written by the pull request that changes the version, from the pull requests merged since the previous version; other pull requests don't edit this file.

## 0.0.1

- The first version of `@noldova/terminal`, `@noldova/terminal.window` and `@noldova/terminal.protocol`, under the MIT License. The three packages move together.
- `@noldova/terminal` holds `module.json` and the runtime part, and exports `./runtime` and `./window`, which re-exports the window package.
- `./runtime` exports `RuntimePart`, `SystemRequirement`, `TerminalException` and `UnsupportedSystemException`; the `terminal.owners` service the runtime part publishes is no class of it, and a module reads it through `@noldova/terminal.protocol`'s `RuntimeTerminalOwners`.
- `@noldova/terminal.protocol` holds the messages the runtime and window parts exchange: `ProtocolReader` reads them through context's `JsonReader` and adds the protocol's limits and its refusal of unknown fields, and its `create` refuses a field a model's constructor refuses as a `JsonException` at the field's path; `ArgumentValidator` checks arguments, with a `find…Problem` form of each check that returns an `ArgumentProblem` instead of throwing.
- The protocol and the module take Noldova's `@noldova/context.exceptions` and `@noldova/context.json` as peers at `>=0.0.7 <0.1.0`, and the window package takes both as optional peers. Refusals are context's `ArgumentException` and `JsonException`.
- Each package has one base exception, which extends context's `Exception`: `TerminalProtocolException`, the runtime's `TerminalException`, and the window's `TerminalWindowException`, which `@noldova/terminal/window` re-exports.
- Each window tells the runtime which owner's terminals it shows, through `terminal.showOwner`, so a run's new terminal starts its shell at its pane's first fit, or at once when no window shows its owner.
- `TerminalSummary` carries `shellName` and `shellKind`, so a window names and marks a new tab from the terminal list.
