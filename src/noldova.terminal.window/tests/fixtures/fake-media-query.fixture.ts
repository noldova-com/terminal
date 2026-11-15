/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class FakeMediaQuery extends EventTarget {
  public readonly media: string;
  public matches: boolean;

  public constructor(media: string, matches: boolean) {
    super();
    this.media = media;
    this.matches = matches;
  }

  public change(matches: boolean): void {
    this.matches = matches;
    this.dispatchEvent(new Event("change"));
  }
}
