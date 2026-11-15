# Agent instructions

Noldova owns this repository and makes the final decisions.

## Documents

Read the owner before you work on its subject, and change a rule there.

| When you… | Read |
|---|---|
| explain what Terminal is or who uses it | [README.md](README.md) |
| change the module's parts or their boundaries, or write code in this repository | [documents/ARCHITECTURE.md](documents/ARCHITECTURE.md) |
| add the module to an app, or change what an app needs to add it | [documents/INTEGRATION.md](documents/INTEGRATION.md) |
| write tests or change what the checks cover | [documents/TESTING.md](documents/TESTING.md) |
| write code, tests, styles, documents or commits | the organization's standards, `https://github.com/noldova-com/.github/blob/main/standards/AGENTS.md` |
| build or change anything a person sees | the organization's UI standard, `https://github.com/noldova-com/.github/blob/main/standards/UI.md` |
| prepare or run a release | [README.md, Releases](README.md#releases) |

## Work

- Every pull request names the issue it resolves in this repository, such as `Closes #N`, and passes the checks [TESTING.md](documents/TESTING.md#the-pull-request-checks) lists.

## Terminal

- Terminal is a module and an app on Noldova Desktop: it installs Noldova Desktop's packages and `@noldova/ui.components.angular` as published versions; never copy, fork or override their files, tokens or styles, and ask for a change through an issue in their repositories.
- The module names no app; an app that includes it configures it through its published API.
- Terminal's public API is everything its packages export.
  A change that breaks it gets a new major version, release notes and a migration path for every app that uses it.
- Terminal runs programs on the person's computer and lets agents type into them: a change to which terminals an agent reaches, what a permission request shows or binds, what a shell's environment holds, or how a shell ends is a risky change, and its review says so.
