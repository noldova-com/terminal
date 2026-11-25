# Terminal

[![Build and test](https://github.com/noldova-com/terminal/actions/workflows/build-and-test.yml/badge.svg?branch=main)](https://github.com/noldova-com/terminal/actions/workflows/build-and-test.yml)
[![npm](https://badgen.net/npm/v/@noldova/terminal)](https://www.npmjs.com/package/@noldova/terminal)
[![License: MIT](https://badgen.net/static/license/MIT/blue)](LICENSE)

Terminal runs shells in terminal panes of a desktop app, and lets the app's AI agents run commands in them with the person's approval.
It is a module for apps built on [Noldova Desktop](https://github.com/noldova-com/desktop), and an app of its own built on Noldova Desktop.
The module is product-neutral: an app adds its package and configures it through its published API, and the module holds no app's names, text or behavior.

Each command an agent wants to run first raises a permission request, and the app's policy decides whether the person is asked.

It targets Windows and Linux on x64, and macOS on x64 and arm64.
Every package is below 1.0 for now, and its API may change from one version to the next.
To report a bug or ask for a change, open an issue in this repository, as the organization's [contributing guide](https://github.com/noldova-com/.github/blob/main/CONTRIBUTING.md) says.
Report a security problem privately, as its [security policy](https://github.com/noldova-com/.github/blob/main/SECURITY.md) says.

## Getting started

An app on Noldova Desktop installs the module's package, pinned exactly, and lists it in `desktop.modules`:

```bash
npm install --save-exact @noldova/terminal
```

```json
{
  "desktop": {
    "modules": [
      { "id": "terminal", "package": "@noldova/terminal" }
    ]
  }
}
```

[documents/INTEGRATION.md](documents/INTEGRATION.md) says what the app needs besides, from the person's computer to the module's API, and [documents/ARCHITECTURE.md](documents/ARCHITECTURE.md) how the module is built.

Each name opens the package's folder and its own README; each badge opens it on npm.

| Package | npm | What it is |
|---|---|---|
| [`terminal`](src/noldova.terminal) | [![npm](https://badgen.net/npm/v/@noldova/terminal)](https://www.npmjs.com/package/@noldova/terminal) | The module: its `module.json` and its runtime part, which runs the shells and the agent tools. |
| [`terminal.window`](src/noldova.terminal.window) | [![npm](https://badgen.net/npm/v/@noldova/terminal.window)](https://www.npmjs.com/package/@noldova/terminal.window) | The window part: the terminal panes, in Angular. |
| [`terminal.protocol`](src/noldova.terminal.protocol) | [![npm](https://badgen.net/npm/v/@noldova/terminal.protocol)](https://www.npmjs.com/package/@noldova/terminal.protocol) | The messages between the runtime and window parts. |

## Building from source

```bash
npm ci
npm run build
npm test
```

The root manifest, `@noldova/terminal.repository`, pins every package the three packages build and test with, and has no workspaces: `npm ci` installs the exact versions the root's lockfile records, which `npm run build` also does with install scripts off when `node_modules` is missing, `npm run build` builds and packs the three packages into `_packages` and installs each archive into the root's `node_modules` without saving it, so every test that uses another package runs its packed archive, as an app does; a change to one package reaches the others' tests only after `npm run build`, which every `npm test`, a filtered run too, checks first: it fails, naming that command, when an archive in `_packages` is missing or older than a file its package packs, and `npm test` runs every check, the last of which installs those packages into a fixture app, so it runs after the build.
[documents/TESTING.md](documents/TESTING.md) says what the checks cover and on which targets.

## Checks

Every pull request into `main` must pass "Check / Linked issue", "Build and test / All targets" and "Build and test / All shells", which [documents/TESTING.md](documents/TESTING.md#the-pull-request-checks) describes.

### Test runners

The protocol's tests, under `src/noldova.terminal.protocol/tests`, are `@noldova/context.testing` test classes, since the organization tests UI with Vitest and all other code with context.testing: `npm test` compiles them with that folder's `tsconfig.json`, runs them with context.testing's runner and fails below 100% coverage of the protocol's production code, as [documents/TESTING.md](documents/TESTING.md#the-pull-request-checks) says.
The module's tests still run with Vitest, until context.testing has the hooks, fake timers and conditional skips they use, and the window part's specs run with Angular's unit-test builder.

### Module range

`.github/workflows/module-range.yml` calls Noldova Desktop's "Module range" workflow, pinned to Noldova Desktop 0.0.16's commit, the release `module.json`'s `noldovaDesktop` range starts at, with `src/noldova.terminal`, on every pull request into `main`, every night and by hand.
It builds and tests the module, with `npm run build` and `npm test`, against the newest published Noldova Desktop inside `module.json`'s `noldovaDesktop` range, `>=0.0.16 <0.1.0`, which Desktop Build's range check chooses at the Noldova Desktop version the root `package.json` pins, 0.0.16, and a failing nightly run opens or updates an issue, so it holds only `contents: read` and `issues: write`.
Its build step first runs `npm run peers:newest`, `scripts/move-peers.ts`, which installs at the root, without saving it, the newest published version of each ranged `@noldova` peer of the three packages but Noldova Desktop's, each `@noldova/context.` package and the UI kit, `@noldova/ui.components.angular`, inside their peer ranges, and the newest of the versions chosen for the context packages, never the kit's, of each other `@noldova/context.` package the root `package.json` pins or `node_modules` holds, since the context packages are released together at one version and no part pins them, so one copy of each is installed, naming in the same install the version `node_modules` holds of each other `@noldova/` package the root `package.json` pins, so the Noldova Desktop version the run moved to stays, and checks that `node_modules` holds it, so the build and the tests run on it, and the newest context packages and UI kit inside their ranges are tested every night too.

### Coverage

`npm test` fails below 100% of the statements, lines, branches and functions of the production code under `src`, as [documents/TESTING.md](documents/TESTING.md#coverage) says, without these exclusions, each granted here with its reason:

| Excluded | Where | Reason |
|---|---|---|
| `src/noldova.terminal.window/**` | The root's `vitest.config.ts` | The window part's specs measure it through Angular's unit-test builder, to the same 100%; the root's suite doesn't run them. |
| `src/*/vitest.config.ts` | The root's `vitest.config.ts` | Each package's test settings, not production code. |
| `src/noldova.terminal.protocol/**` | The root's `vitest.config.ts` | The protocol's context.testing tests measure it, to the same 100%; the root's Vitest suite doesn't run them. |
| `src/app/enums/**` | `src/noldova.terminal.window/angular.json` | The window part's enum files, which the Angular standard leaves out of coverage. |
| The compiler's development-mode class-metadata calls | `src/noldova.terminal.window/tests/coverage/class-metadata-coverage.ts` | Code Angular's compiler adds, which runs only in development mode, as the Angular standard says; the plugin marks the calls and reports how many it skipped. |

### Fixed pauses

Tests wait for the code's own event or promise; the module's end-to-end tests wait for a shell's output through their fixtures, and the window part's specs through `vi.waitFor`.
The test-wait check in `npm test` refuses a fixed pause of the forms TESTING.md names in any test file this table doesn't list, and a listed file that no longer pauses; it sees only those forms, so the table after it lists the waits on time it can't see.

| Test file | Why it pauses |
|---|---|
| `src/noldova.terminal/tests/services/pseudo-terminal.e2e.test.ts` | Between checks, 25 ms apart, of whether a shell's background child still runs after the shell ended, for up to 10 seconds: no event tells a process's end to a program that isn't its parent. |
| `src/noldova.terminal.window/tests/app/services/command-suggestion.spec.ts` | One spec sets a 10 ms `setTimeout` under the specs' fake clock, so nothing waits in real time, to check that the clock advances past idle callbacks that ask for more, as xterm's idle tasks do; it tests the specs' clock, not this repository's code, and whether it stays is the maintainers' call. |
| `src/noldova.terminal.window/tests/app/components/terminal-panel/terminal-panel-look.spec.ts` | Two animation frames before each screenshot or pixel read, since xterm's WebGL draw and the browser's composite of it raise no event. |

| Test file | How it waits on time |
|---|---|
| `src/noldova.terminal/tests/fixtures/shell-integration-suite.fixture.ts`, the shell integration tests that each `src/noldova.terminal/tests/services/shell-integration.<shell>.e2e.test.ts` runs | `waitForQuietAsync` passes after 1 second with no output from the shell, measured with `Date.now`, at 14 calls, where a test checks that nothing more arrives, or goes on while the shell marks no new prompt: a line still being typed, a continuation line, a line cancelled with Ctrl+C, an answer to a request for options, or a prompt redrawn in place; elsewhere a test waits for the shell's next prompt mark; a test of PowerShell's profiles retries through `vi.waitFor` while it writes the real `$PROFILE`; and the holder of a profile file sleeps 1.5 seconds in PowerShell. On Windows, each PowerShell file's setup has a PowerShell scan its modules and stay 15 seconds, since PowerShell writes its module analysis cache only while it runs, about 10 seconds after a scan, and says so by no event; the file's tests run meanwhile, and the test of the names PowerShell would run waits for it. |
| `src/noldova.terminal/tests/runtime-part.e2e.test.ts` | Its checks that a shell and the programs it started ended poll `ProcessState.isRunning` through `vi.waitFor`, as the pseudo-terminal file does, since no event tells a process's end to a program that isn't its parent. |
| `src/noldova.terminal/tests/fixtures/process-state.e2e.test.ts` | It polls through `vi.waitFor` until the shell has become `sleep`, and until a released child no longer counts as running, for the same reason. |

### Fake clocks in the window specs

These specs fake the timers of the test page, which all spec files share, for a deadline no event reaches, and each restores real timers after every test:

| Spec | Why it fakes the clock |
|---|---|
| `src/noldova.terminal.window/tests/app/services/completion-list.spec.ts` | One test checks that a Tab the shell answers with only a bell gives up after the 1 second the list waits for an answer; no event says the shell answered nothing. |
| `src/noldova.terminal.window/tests/app/services/renderer-switch.spec.ts` | One test runs the timer xterm's WebGL addon sets after a lost context, before it reports the loss. |
| `src/noldova.terminal.window/tests/app/services/command-suggestion.spec.ts` | Its tests of keys held back after a key the shell answers slowly wait out the moment with no new output that ends the hold; no event says that nothing more came. |

### Test files over 1 second

A unit test file may take 1 second; `npm run test:timing` fails for a file past that bar plus 20%, from the median of 3 runs, unless this table accepts it, with the reason it needs that time.
The times are each target's in one full `npm test` run on the test machines, under the whole suite's load: Linux, macOS on the slower of the two Macs, and Windows.
A target with no time for a file skips it or runs it within 1 second.

| Test file | Time | Why |
|---|---|---|
| `src/noldova.terminal/tests/services/shell-integration.git-bash.e2e.test.ts` | Windows 72 s | It starts Git Bash, many times over, and waits for its prompts, commands and exit through a real pseudo-terminal. |
| `src/noldova.terminal/tests/services/shell-integration.powershell.e2e.test.ts` | Windows 49 s | It starts Windows PowerShell, many times over, and waits for its prompts, commands and exit through a real pseudo-terminal, and its setup warms its module analysis cache for 15 seconds while its tests run, which its test of the names it would run waits for; on Windows it also runs the test of a shell's nonce file, after its shell tests. |
| `src/noldova.terminal/tests/services/shell-integration.pwsh.e2e.test.ts` | Linux 24 s, macOS 25 s, Windows 42 s | It starts PowerShell 7, many times over, and waits for its prompts, commands and exit through a real pseudo-terminal, and its setup warms its module analysis cache for 15 seconds while its tests run, which its test of the names it would run waits for. |
| `src/noldova.terminal/tests/services/shell-integration.zsh.e2e.test.ts` | Linux 18 s, macOS 18 s | It starts zsh, many times over, and waits for its prompts, commands and exit through a real pseudo-terminal. |
| `src/noldova.terminal/tests/services/shell-integration.bash.e2e.test.ts` | Linux 16 s, macOS 16 s | It starts bash, many times over, and waits for its prompts, commands and exit through a real pseudo-terminal, and sh once, and runs the test of a shell's nonce file; on Windows, where neither is installed, it skips every test. |
| `src/noldova.terminal/tests/services/shell-integration.cmd.e2e.test.ts` | Windows 1.4 s | It opens Command Prompt in a terminal twice and runs it twice for a note, after the runtime part's start and the search for shells. |
| `src/noldova.terminal/tests/runtime-part.e2e.test.ts` | Linux 28 s, macOS 37 s, Windows 87 s | It starts the module's runtime part with real shells and drives it through its published API, as an app does. |
| `src/noldova.terminal/tests/services/one-shot-command.e2e.test.ts` | Windows 29 s | Windows only: it runs a command after each developer shell's start and in each WSL distribution. |
| `src/noldova.terminal/tests/services/terminal-host.test.ts` | Linux 13 s, macOS 14 s, Windows 15 s | Its 225 tests cover every request the host answers, each with its own host and sessions, and many with history files on disk. |
| `src/noldova.terminal/tests/services/context-pty-spawner.test.ts` | Windows 16 s | Each of its 5 tests starts Node.js in a real pseudo-terminal, which on Windows starts a pseudo console, conhost and Node.js for each. |
| `src/noldova.terminal/tests/services/pseudo-terminal.e2e.test.ts` | Windows 5.6 s | It runs real shells through node-pty, and waits up to its listed pause for a background child's end. |
| `src/noldova.terminal/tests/services/terminal-session.test.ts` | Linux 2.0 s, macOS 4.1 s, Windows 2.5 s | Its tests write and read each session's history files in a temporary folder. |
| `src/noldova.terminal/tests/services/completion-source.e2e.test.ts` | Linux 1.3 s, macOS 1.8 s, Windows 1.4 s | It runs this computer's PowerShell twice for a real lookup, Windows PowerShell on Windows and PowerShell 7 elsewhere, and waits for the first to end on its own. |
| `src/noldova.terminal/tests/services/command-runner.test.ts` | Linux 1.2 s, macOS 1.5 s, Windows 1.4 s | Its 14 tests each start a real Node.js program, and two run one past its time, to its own end or to the end it is given. |
| `src/noldova.terminal/tests/services/terminal-mirror.test.ts` | macOS 1.7 s, Windows 1.6 s | Its 19 tests write a headless xterm's lines to history files in a temporary folder. |
| `src/noldova.terminal/tests/services/line-process.test.ts` | macOS 1.4 s, Windows 1.0 s | Its 16 tests each start a real Node.js program and read its lines. |
| `src/noldova.terminal/tests/services/agent-terminals.test.ts` | Linux 1.2 s, macOS 1.2 s, Windows 1.3 s | Its tests launch and end the terminals each agent reaches, through a host each. |
| `src/noldova.terminal/tests/services/windows-environment.test.ts` | Linux 1.3 s, macOS 1.3 s, Windows 1.3 s | Its 5 tests of an export reg.exe fails and exports again wait the real 250 ms the source waits before that second export. |

### Component tests over 1 second

`npm run test:timing` names each window spec test whose median is over 1 second; this table gives each spec's cause, with each test's median from the 3 runs on the Linux test machine.

| Spec | Tests over 1 second | Why |
|---|---|---|
| `src/noldova.terminal.window/tests/app/services/terminal-pager.spec.ts` | 9, of 1.23, 1.07, 1.09, 1.00, 1.06, 1.23, 1.17, 1.05 and 1.01 s | Each fills a pager capped at 12 pages of 500 lines, past which it leaves the live screen behind, so a real xterm writes and wraps 6,000 lines or more, and one makes room for over 10,000 spare rows. |
| `src/noldova.terminal.window/tests/app/components/terminal-pane/terminal-pane-appearance-look.spec.ts` | 1, 1.2 s | It changes the code font and lets xterm measure its cells and redraw the whole screen with WebGL before it reads a screenshot. |
| `src/noldova.terminal.window/tests/app/components/terminal-panel/terminal-panel-look.spec.ts` | 1, 1.2 s | Its first test starts the shell and draws a running and an ended terminal, with WebGL, before its screenshots. |

### Spec files over a 100 ms median test

`npm run test:timing` fails for a window spec file, a look spec's too, whose median test is over 100 milliseconds plus 20%, unless this table accepts it, with its median on the test machines where it is over, the look specs' on the Linux one, and its cause.

| Spec file | Median test | Why |
|---|---|---|
| `src/noldova.terminal.window/tests/app/services/terminal-pager.spec.ts` | macOS 133 ms, Windows 140 ms | Nine of its 29 tests fill a real xterm with 6,000 lines or more, as Component tests over 1 second says; on Linux its median is under the bar. |
| `src/noldova.terminal.window/tests/app/components/terminal-pane/terminal-pane-appearance-look.spec.ts` | 477 ms | Each test changes the code font, a text size, the mode or the theme, lets xterm redraw with WebGL, and reads its pixels from a screenshot of the page. |
| `src/noldova.terminal.window/tests/app/components/terminal-pane/terminal-pane-command-colors-look.spec.ts` | 309 ms | Each test types a command line into a real shell pane, waits for its colors to draw, and reads each cell's ink from a screenshot. |
| `src/noldova.terminal.window/tests/app/components/terminal-pane/terminal-pane-completion-look.spec.ts` | 263 ms | Each test opens the completion list over a drawn pane and checks its place and colors in a screenshot. |
| `src/noldova.terminal.window/tests/app/components/terminal-pane/terminal-pane-suggestion-look.spec.ts` | 316 ms | Each test draws a suggestion after the typed text and reads its color from a screenshot. |
| `src/noldova.terminal.window/tests/app/components/terminal-panel/terminal-panel-look.spec.ts` | 314 ms | Its 27 tests draw the panel in the kit's looks, light, dark and forced colors, and read xterm's pixels from screenshots, after two animation frames each. |
| `src/noldova.terminal.window/tests/app/services/embedded-terminal-look.spec.ts` | 292 ms | Each test embeds a pane in a host and checks where its cells draw in a screenshot. |

## Flake proof

The "Flake proof" workflow, `.github/workflows/flake-proof.yml`, calls the organization's shared flake proof, which the `.github` repository's README describes under "Proving flakes", pinned to a full commit SHA.
It runs `npm test`, or the npm script its `script` input names, many times on GitHub-hosted Linux, Windows and macOS runners, as "Build and test" does, to show that a fix holds a flaky test steady.
A member starts it by hand, and each job builds once and then runs the tests in a loop:

```bash
gh workflow run flake-proof.yml --ref <branch> -f runs=10 -f jobs=2 -f "targets=linux-x64 windows-x64"
```

| Input | What it takes | Default |
|---|---|---|
| `ref` | The branch, tag or commit to test. | The branch the run starts on. |
| `filter` | The arguments `npm test` passes to Vitest, separated by spaces, such as a test file's path; such a run keeps measuring coverage but drops its gates, and empty runs the whole suite. | Empty. |
| `script` | The npm script each run runs with the filter. | `test` |
| `prepare` | The npm scripts each job runs once after the build and before the runs, separated by spaces. | Empty. |
| `display` | Runs each run on Linux under a virtual display and a session bus, for a script that opens windows and starts no display. | Off. |
| `runs` | The runs per target, 1 to 200, shared among the jobs, each of which stops after 120 minutes. | 10 |
| `jobs` | The parallel jobs per target, 1 to 4. | 2 |
| `targets` | The targets, separated by spaces, from `linux-x64`, `linux-arm64`, `windows-x64`, `windows-arm64`, `macos-x64` and `macos-arm64`. | `linux-x64 windows-x64` |

The run's summary gives each job's runs, passes and failures; a failed run's last 60 log lines are in the job's log, and its whole log in the job's artifact for the days the shared settings name.

The flake-proof job's concurrency group is named by `ref` and the first 16 hex digits of the SHA-256 of `script`, `prepare`, `display` and `filter`, which a first job, "Concurrency group", works out, since GitHub refuses a run whose group is over 400 characters before it starts, as a filter that names several tests in full makes it.
Runs of different inputs go side by side; a second run of the same `ref`, `script`, `prepare`, `display` and `filter` shows its first job done and waits at its flake-proof job until the first run ends.

## Releases

The three packages are published to npm by the "Release npm packages" workflow, `.github/workflows/release-npm.yml`, through npm's trusted publishing, so no token is stored, and a release never deletes a published version.
[documents/ARCHITECTURE.md](documents/ARCHITECTURE.md#the-package) says how a version is built, checked and released, and [CHANGELOG.md](CHANGELOG.md) what each version changed.

## License

Terminal is licensed under the [MIT License](LICENSE).
Its third-party packages keep their own licenses, which their packages carry.

Angular, GitHub, Linux, macOS, npm, Vitest, Windows and the other product names used here are names of their owners.

## Trademarks

The code is under the MIT License, while the name "Noldova" and its logo are not: the MIT License grants no right to them.
A build from this code that is published by anyone but Noldova uses another name and its own logo.
