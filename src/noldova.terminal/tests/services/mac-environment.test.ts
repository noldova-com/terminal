/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";

import { afterEach, describe, it, vi } from "vitest";

import { MacEnvironment } from "../../src/services/mac-environment.ts";
import { FakeLineProcess, FakeLineProcessStarter } from "../fixtures/fake-line-process.fixture.ts";

class MacFixture {
  public readonly starter: FakeLineProcessStarter = new FakeLineProcessStarter();
  public readonly asked: string[] = [];
  public readonly source: MacEnvironment;

  public constructor(environment: Readonly<Record<string, string | undefined>> = { PATH: "/usr/bin" }, installed: boolean = true) {
    this.source = new MacEnvironment(environment, this.starter, "en-US", t => {
      this.asked.push(t);
      return Promise.resolve(installed);
    });
  }

  public get process(): FakeLineProcess {
    return this.starter.last;
  }
}

async function isWaitingAsync(promise: Promise<unknown>): Promise<boolean> {
  const waiting: unique symbol = Symbol("waiting");
  return await Promise.race([promise, Promise.resolve(waiting)]) === waiting;
}

describe("MacEnvironment", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("reads the person's region setting once at the start, and gives shells a UTF-8 locale in its language and region", async () => {
    const fixture: MacFixture = new MacFixture();
    fixture.source.start();
    const reading: Promise<Readonly<Record<string, string | undefined>>> = fixture.source.readAsync();

    assert.equal(fixture.process.file, "/usr/bin/defaults");
    assert.deepEqual(fixture.process.args, ["read", "-g", "AppleLocale"]);
    assert.ok(await isWaitingAsync(reading));
    fixture.process.line("fr_FR@rg=dezzzz");

    assert.deepEqual(await reading, { PATH: "/usr/bin", LANG: "fr_FR.UTF-8" });
    assert.deepEqual(await fixture.source.readAsync(), { PATH: "/usr/bin", LANG: "fr_FR.UTF-8" });
    assert.equal(fixture.starter.started.length, 1);
    assert.equal(fixture.process.killed, false);
    assert.deepEqual(fixture.asked, ["fr_FR.UTF-8"]);
  });

  it("passes on a failure to look for the locale to the shell that asked, and reads the region setting again for the next one", async () => {
    const failure: Error = new Error("EIO: i/o error");
    let looks: number = 0;
    const starter: FakeLineProcessStarter = new FakeLineProcessStarter();
    const source: MacEnvironment = new MacEnvironment({ PATH: "/usr/bin" }, starter, "en-US", () => ++looks === 1 ? Promise.reject(failure) : Promise.resolve(true));
    source.start();
    const first: Promise<Readonly<Record<string, string | undefined>>> = source.readAsync();
    starter.last.line("fr_FR");

    await assert.rejects(first, failure);
    const second: Promise<Readonly<Record<string, string | undefined>>> = source.readAsync();
    starter.last.line("fr_FR");

    assert.deepEqual(await second, { PATH: "/usr/bin", LANG: "fr_FR.UTF-8" });
    assert.equal(starter.started.length, 2);
  });

  it("takes the language and region from a region setting with a script, or a language alone", async () => {
    const readAsync = async (setting: string): Promise<Readonly<Record<string, string | undefined>>> => {
      const fixture: MacFixture = new MacFixture();
      const reading: Promise<Readonly<Record<string, string | undefined>>> = fixture.source.readAsync();
      fixture.process.line(setting);
      return await reading;
    };

    assert.deepEqual(await readAsync("zh-Hant_TW"), { PATH: "/usr/bin", LANG: "zh_TW.UTF-8" });
    assert.deepEqual(await readAsync("fr"), { PATH: "/usr/bin", LANG: "fr_FR.UTF-8" });
    assert.deepEqual(await readAsync("qaa"), { PATH: "/usr/bin", LC_CTYPE: "UTF-8" });
  });

  it("gives only UTF-8 characters when macOS has no locale for the language and region, asking once", async () => {
    const fixture: MacFixture = new MacFixture({ PATH: "/usr/bin" }, false);
    const reading: Promise<Readonly<Record<string, string | undefined>>> = fixture.source.readAsync();
    fixture.process.line("th_TH");

    assert.deepEqual(await reading, { PATH: "/usr/bin", LC_CTYPE: "UTF-8" });
    assert.deepEqual(fixture.asked, ["th_TH.UTF-8"]);
  });

  it("falls back to the runtime's locale when the region setting isn't a locale", async () => {
    const fixture: MacFixture = new MacFixture();
    const reading: Promise<Readonly<Record<string, string | undefined>>> = fixture.source.readAsync();
    fixture.process.line("");

    assert.deepEqual(await reading, { PATH: "/usr/bin", LANG: "en_US.UTF-8" });
  });

  it("passes on a failure to read the region setting other than an unknown locale", () => {
    vi.useFakeTimers();
    const failure: TypeError = new TypeError("broken");
    const fixture: MacFixture = new MacFixture();
    void fixture.source.readAsync();
    vi.stubGlobal("Intl", {
      Locale: class {
        public constructor() {
          throw failure;
        }
      }
    });
    try {
      assert.throws(() => fixture.process.line("fr_FR"), failure);
    }
    finally {
      vi.unstubAllGlobals();
    }
  });

  it("falls back to the runtime's locale as soon as defaults ends without an answer, since its output has closed by then", async () => {
    vi.useFakeTimers();
    const failed: MacFixture = new MacFixture();
    const failing: Promise<Readonly<Record<string, string | undefined>>> = failed.source.readAsync();
    failed.process.exit("defaults exited with 1.");

    assert.deepEqual(await failing, { PATH: "/usr/bin", LANG: "en_US.UTF-8" });
    assert.equal(failed.process.killed, false);
    assert.equal(vi.getTimerCount(), 0);
  });

  it("doesn't stop defaults once it has answered or ended, also when the runtime ends", async () => {
    const answered: MacFixture = new MacFixture();
    const reading: Promise<Readonly<Record<string, string | undefined>>> = answered.source.readAsync();
    answered.process.line("de_DE");
    await reading;
    answered.source.end();

    vi.useFakeTimers();
    const ended: MacFixture = new MacFixture();
    const falling: Promise<Readonly<Record<string, string | undefined>>> = ended.source.readAsync();
    ended.process.exit("defaults exited with 0.");
    ended.source.end();

    assert.deepEqual(await falling, { PATH: "/usr/bin", LANG: "en_US.UTF-8" });
    assert.deepEqual([answered.process.killed, ended.process.killed], [false, false]);
  });

  it("falls back to the runtime's locale when defaults doesn't answer within 2 seconds, and ends it", async () => {
    vi.useFakeTimers();
    const fixture: MacFixture = new MacFixture();
    fixture.source.start();
    const reading: Promise<Readonly<Record<string, string | undefined>>> = fixture.source.readAsync();

    vi.advanceTimersByTime(1_999);
    assert.ok(await isWaitingAsync(reading));
    vi.advanceTimersByTime(1);

    assert.deepEqual(await reading, { PATH: "/usr/bin", LANG: "en_US.UTF-8" });
    assert.ok(fixture.process.killed);
  });

  it("ends a read under way with the runtime's locale", async () => {
    const fixture: MacFixture = new MacFixture();
    fixture.source.start();
    const reading: Promise<Readonly<Record<string, string | undefined>>> = fixture.source.readAsync();

    fixture.source.end();

    assert.deepEqual(await reading, { PATH: "/usr/bin", LANG: "en_US.UTF-8" });
    assert.ok(fixture.process.killed);
  });

  it("leaves a locale that is set as it is, without reading the region setting, and takes an empty one as unset", async () => {
    for (const environment of [{ LANG: "de_DE.ISO8859-1" }, { LC_ALL: "C" }, { LC_CTYPE: "ja_JP.UTF-8" }]) {
      const fixture: MacFixture = new MacFixture(environment);
      fixture.source.start();
      assert.deepEqual(await fixture.source.readAsync(), environment);
      assert.deepEqual(fixture.starter.started, []);
      fixture.source.end();
    }

    const empty: MacFixture = new MacFixture({ LANG: "", LC_ALL: "", LC_CTYPE: "" });
    const reading: Promise<Readonly<Record<string, string | undefined>>> = empty.source.readAsync();
    empty.process.line("en_GB");
    assert.deepEqual(await reading, { LANG: "en_GB.UTF-8", LC_ALL: "", LC_CTYPE: "" });
  });

  it("finds no locale that macOS's locale folder lacks", async () => {
    assert.equal(await MacEnvironment.hasSystemLocaleAsync("qaa_QA.UTF-8"), false);
  });

  it("finds a locale macOS has", async context => {
    context.skip(process.platform !== "darwin", "Only macOS has its locale folder at /usr/share/locale with en_US.UTF-8 in it.");
    assert.equal(await MacEnvironment.hasSystemLocaleAsync("en_US.UTF-8"), true);
  });
});
