/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { ShellClients } from "@noldova/desktop.protocol";
import { RequestContext } from "@noldova/desktop.runtime";
import { describe, it } from "vitest";

import { RequestClient } from "../../src/models/request-client.ts";

describe("RequestClient", () => {
  it("reads a request's connection, window and page, and counts only the app's main process, by Noldova Desktop's name for it, as the app", () => {
    const signal: AbortSignal = new AbortController().signal;

    const app: RequestClient = RequestClient.fromContext(new RequestContext(ShellClients.mainProcess, null, signal, 1, 3, 7));
    const commandLine: RequestClient = RequestClient.fromContext(new RequestContext(ShellClients.commandLine, null, signal, 2));
    const otherClient: RequestClient = RequestClient.fromContext(new RequestContext("module/example", null, signal, 4));
    const misnamed: RequestClient = RequestClient.fromContext(new RequestContext("mainProcess", null, signal, 5, 1));

    assert.deepEqual([app.connection, app.window, app.isApp, app.page], [1, 3, true, 7]);
    assert.deepEqual([commandLine.connection, commandLine.window, commandLine.isApp, commandLine.page], [2, null, false, null]);
    assert.deepEqual([otherClient.isApp, misnamed.isApp], [false, false]);
  });
});
