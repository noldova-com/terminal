/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { WslDistributionReader } from "../services/wsl-distribution.reader.ts";

export class WslLauncher {
  public readonly file: string;
  public readonly reader: WslDistributionReader;

  public constructor(file: string, reader: WslDistributionReader) {
    this.file = file;
    this.reader = reader;
  }
}
