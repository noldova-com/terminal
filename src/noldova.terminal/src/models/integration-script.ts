/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class IntegrationScript {
  public readonly fileName: string;
  public readonly text: string;

  public constructor(fileName: string, text: string) {
    this.fileName = fileName;
    this.text = text;
  }
}
