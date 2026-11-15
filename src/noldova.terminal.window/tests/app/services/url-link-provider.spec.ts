/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Terminal, type ILink } from "@xterm/xterm";
import { afterEach, describe, expect, it } from "vitest";

import { UrlLinkProvider } from "../../../src/app/services/url-link-provider.ts";

class LinkHarness {
  public readonly terminal: Terminal = new Terminal({ cols: 80, rows: 5 });
  public readonly events: string[] = [];
  public readonly provider: UrlLinkProvider = new UrlLinkProvider(
    this.terminal,
    (_event, url) => this.events.push(`open ${url}`),
    url => this.events.push(`hover ${url}`));

  public writeAsync(text: string): Promise<void> {
    return new Promise<void>(resolve => this.terminal.write(text, resolve));
  }

  public linksOf(line: number): ILink[] | undefined {
    let found: ILink[] | undefined;
    this.provider.provideLinks(line, t => found = t);
    return found;
  }
}

describe("UrlLinkProvider", () => {
  const harnesses: LinkHarness[] = [];

  function createHarness(): LinkHarness {
    const harness: LinkHarness = new LinkHarness();
    harnesses.push(harness);
    return harness;
  }

  afterEach(() => {
    for (const harness of harnesses.splice(0))
      harness.terminal.dispose();
  });

  it("offers each plain web or mail link on a row, without the punctuation after it", async () => {
    const harness: LinkHarness = createHarness();
    await harness.writeAsync("see https://noldova.com/docs?a=1. or mailto:team@example.com)");

    const links: ILink[] | undefined = harness.linksOf(1);

    expect(links?.map(t => [t.text, t.range.start.x, t.range.end.x, t.range.start.y])).toEqual([
      ["https://noldova.com/docs?a=1", 5, 32, 1],
      ["mailto:team@example.com", 38, 60, 1]
    ]);
  });

  it("hands activation and hovering to the pane", async () => {
    const harness: LinkHarness = createHarness();
    await harness.writeAsync("https://noldova.com");
    const link: ILink | undefined = harness.linksOf(1)?.[0];
    const click: MouseEvent = new MouseEvent("click");

    link?.activate(click, "https://noldova.com");
    link?.hover?.(click, "https://noldova.com");
    link?.leave?.(click, "https://noldova.com");

    expect(harness.events).toEqual(["open https://noldova.com", "hover https://noldova.com", "hover null"]);
  });

  it("offers a link the terminal wrapped over two rows, whole, on each of its rows", async () => {
    const harness: LinkHarness = createHarness();
    const url: string = `https://noldova.com/${"a".repeat(30)}`;
    await harness.writeAsync(`${"x".repeat(69)} ${url}`);

    const rows: (ILink[] | undefined)[] = [harness.linksOf(1), harness.linksOf(2)];

    expect(rows.map(t => t?.map(link => [link.text, link.range.start.x, link.range.start.y, link.range.end.x, link.range.end.y]))).toEqual([
      [[url, 71, 1, 40, 2]], [[url, 71, 1, 40, 2]]]);
  });

  it("places a link after a wide character by the cells it takes", async () => {
    const harness: LinkHarness = createHarness();
    await harness.writeAsync("\u898b https://noldova.com");

    expect(harness.linksOf(1)?.map(t => [t.text, t.range.start.x, t.range.end.x])).toEqual([["https://noldova.com", 4, 22]]);
  });

  it("offers a row none of a wrapped line's links that don't reach it", async () => {
    const harness: LinkHarness = createHarness();
    await harness.writeAsync(`https://noldova.com ${"b".repeat(80)}`);

    expect([harness.linksOf(1)?.map(t => t.text), harness.linksOf(2)]).toEqual([["https://noldova.com"], undefined]);
  });

  it("reads a wrapped line only as far as the longest link from a row, so a row far below a link offers none", async () => {
    const harness: LinkHarness = createHarness();
    await harness.writeAsync(`https://noldova.com ${"b".repeat(80 * 60)}`);

    expect([harness.linksOf(1)?.map(t => t.text), harness.linksOf(61)]).toEqual([["https://noldova.com"], undefined]);
  });

  it("offers nothing for a row without links or a row past the buffer", async () => {
    const harness: LinkHarness = createHarness();
    await harness.writeAsync("file:///etc/passwd and plain text");

    expect([harness.linksOf(1), harness.linksOf(500)]).toEqual([undefined, undefined]);
  });
});
