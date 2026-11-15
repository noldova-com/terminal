# @noldova/terminal.window

The terminal module's window part, in Angular: terminal panes over the module's shells, in the bottom panel and as documents, and the API an app uses to open, launch, embed and run commands in terminals.
It is compiled by Angular's compiler in partial compilation mode; Angular, Noldova Desktop's and context's packages and the interface kit are optional peers, which the app's window workspace provides.

An app reaches its API through [`@noldova/terminal`](https://github.com/noldova-com/terminal/tree/main/src/noldova.terminal)'s `./window` export, and the module pins it at its own version.
This folder is an Angular project of its own and one of the root's npm workspaces, whose packages the root's lockfile records and its `npm ci` installs.
[documents/ARCHITECTURE.md](https://github.com/noldova-com/terminal/blob/main/documents/ARCHITECTURE.md) says how it is built, and the [README](https://github.com/noldova-com/terminal#readme) how to build and test it.
It is licensed under the [MIT License](https://github.com/noldova-com/terminal/blob/main/LICENSE).
Its compiled terminal pane carries the styles of `@xterm/xterm`'s `css/xterm.css`, copyright the xterm.js authors, under xterm.js's own [MIT License](https://github.com/xtermjs/xterm.js/blob/master/LICENSE), whose notice applies to those styles.
The pane's scrollbar and completion list sit one and two layers above xterm's highest one, the z-index 10 of `@xterm/xterm` 6.0.0's `css/xterm.css`, which the pane's stylesheet names `--terminal-pane-xterm-top-layer`; an update of `@xterm/xterm` checks that layer again.

## xterm.js's notice

The styles of `@xterm/xterm` 6.0.0 that the compiled terminal pane carries come under this notice, from that package's `LICENSE`:

```text
Copyright (c) 2017-2019, The xterm.js authors (https://github.com/xtermjs/xterm.js)
Copyright (c) 2014-2016, SourceLair Private Company (https://www.sourcelair.com)
Copyright (c) 2012-2013, Christopher Jeffrey (https://github.com/chjj/)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
```
