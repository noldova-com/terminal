# @noldova/terminal

The terminal module for apps on [Noldova Desktop](https://github.com/noldova-com/desktop): terminal panes over real shells, and agent tools that run commands through permission requests.
It holds the module's `module.json`, `menus.json` and `settings.json`, and its runtime part, which starts the shells in Noldova Desktop's pseudo-terminals, keeps a headless mirror of each terminal and registers the agent tools.

It exports `./runtime`, the runtime part, and `./window`, which re-exports the published API of the window part, [`@noldova/terminal.window`](https://github.com/noldova-com/terminal/tree/main/src/noldova.terminal.window).
It pins that package and [`@noldova/terminal.protocol`](https://github.com/noldova-com/terminal/tree/main/src/noldova.terminal.protocol) at its own version.

An app installs it pinned exactly and lists it in `desktop.modules`, as [documents/INTEGRATION.md](https://github.com/noldova-com/terminal/blob/main/documents/INTEGRATION.md) says.
[documents/ARCHITECTURE.md](https://github.com/noldova-com/terminal/blob/main/documents/ARCHITECTURE.md) says how it is built, and the [README](https://github.com/noldova-com/terminal#readme) how to build and test it.
It is licensed under the [MIT License](https://github.com/noldova-com/terminal/blob/main/LICENSE).
