/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import PackageInfo from "./package-info.ts";

export default class Config {
  public static readonly BUILD_FOLDER: string = "_build/tests";
  public static readonly COVERAGE_FOLDER: string = "_build/protocol-coverage";

  public static readonly PACKAGES_INFO: readonly PackageInfo[] = [
    new PackageInfo("noldova.terminal.protocol", "noldova.terminal.protocol", "@noldova/terminal.protocol")
  ];
}
